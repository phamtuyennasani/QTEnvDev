import { randomUUID } from 'node:crypto'
import { link, lstat, mkdir, open, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppHost } from '@shared/app'
import { makeApacheConf } from '../Apache/Host'
import { makeCaddyConf } from '../Caddy/Host'
import { makeFrankenPHPConf } from '../FrankenPHP/Host'
import { makeNginxConf } from '../Nginx/Host'
import { isWebsiteFileId } from './Transaction'

const generators = {
  nginx: makeNginxConf,
  apache: makeApacheConf,
  caddy: makeCaddyConf,
  frankenphp: makeFrankenPHPConf,
  rewrite: makeNginxConf
}

export function isWebsiteConfigKind(kind: unknown): kind is keyof typeof generators {
  return typeof kind === 'string' && Object.hasOwn(generators, kind)
}

const hasCode = (error: unknown, code: string) => (error as NodeJS.ErrnoException)?.code === code

async function isExistingConfig(path: string) {
  try {
    if (!(await lstat(path)).isFile())
      throw new Error('The configuration path is not a regular file.')
    return true
  } catch (error) {
    if (hasCode(error, 'ENOENT')) return false
    throw error
  }
}

export async function restoreWebsiteConfig(
  base: string,
  host: AppHost,
  kind: keyof typeof generators
): Promise<'created' | 'exists'> {
  if (!isWebsiteFileId(host.id) || !isWebsiteConfigKind(kind)) {
    throw new Error('Invalid website or configuration type.')
  }
  const directory = join(base, 'vhost', kind)
  const target = join(directory, `${host.id}.conf`)
  if (await isExistingConfig(target)) return 'exists'

  let generated: string | undefined
  await generators[kind](host, async (path, content) => {
    if (path === target) generated = content
  })
  if (generated === undefined) throw new Error('The generator did not report a configuration file.')

  await mkdir(directory, { recursive: true })
  const temporary = join(directory, `.${host.id}.${randomUUID()}.tmp`)
  const handle = await open(temporary, 'wx', 0o644)
  try {
    try {
      await handle.writeFile(generated)
    } finally {
      await handle.close()
    }
    // A link publishes the complete contents and fails if another writer won.
    try {
      await link(temporary, target)
    } catch (error) {
      if (hasCode(error, 'EEXIST') && (await isExistingConfig(target))) return 'exists'
      throw error
    }
    return 'created'
  } finally {
    await rm(temporary, { force: true }).catch((error) => {
      console.warn('Could not remove temporary website configuration:', error)
    })
  }
}
