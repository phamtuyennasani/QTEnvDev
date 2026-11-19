import { chmod, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { removeByRoot } from '../../Fn'

const missing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === 'ENOENT'
const kinds = ['nginx', 'apache', 'caddy', 'frankenphp', 'rewrite']
const logSuffixes = [
  '.log',
  '.error.log',
  '.caddy.log',
  '.frankenphp.log',
  '-access_log',
  '-error_log'
]
const safeBasename = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/
const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i
const isSafeBasename = (value: string) =>
  safeBasename.test(value) && !value.endsWith('.') && !reserved.test(value)

export const isWebsiteFileId = (id: unknown) =>
  typeof id === 'number'
    ? Number.isSafeInteger(id) && id > 0
    : typeof id === 'string' && /^[A-Za-z0-9]{1,64}$/.test(id) && isSafeBasename(id)

export function websitePaths(base: string, id: number, legacyName?: string) {
  const key = String(id)
  if (!isWebsiteFileId(id)) {
    throw new Error('The website identifier cannot be used as a file name.')
  }
  const names = new Set([key])
  if (legacyName && isSafeBasename(legacyName)) names.add(legacyName)
  const configs = [...names].flatMap((name) =>
    kinds.map((kind) => join(base, 'vhost', kind, `${name}.conf`))
  )
  const logs = [...names].flatMap((name) =>
    logSuffixes.map((suffix) => join(base, 'vhost', 'logs', name + suffix))
  )
  return { configs, logs, certificate: join(base, 'CA', key) }
}

type Entry = { mode: number; content: Buffer } | { mode: number; children: Map<string, Entry> }

const inspect = (path: string) =>
  lstat(path).catch((error) => {
    if (!missing(error)) throw error
    return undefined
  })

async function capture(path: string, directory: boolean): Promise<Entry | undefined> {
  const info = await inspect(path)
  if (!info) return undefined
  const mode = info.mode & 0o777
  if (directory && info.isDirectory()) {
    const children = new Map<string, Entry>()
    for (const name of await readdir(path)) {
      const child = await capture(join(path, name), false)
      if (!child) throw new Error(`Website configuration changed while reading ${path}.`)
      children.set(name, child)
    }
    return { mode, children }
  }
  if (!directory && info.isFile()) return { mode, content: await readFile(path) }
  throw new Error(`Unexpected website configuration entry: ${path}`)
}

async function restore(path: string, entry: Entry | undefined, directory: boolean) {
  const info = await inspect(path)
  if (!entry) {
    if (info) await rm(path, { force: true, recursive: directory })
    return
  }
  if ('content' in entry) {
    if (info && !info.isFile()) throw new Error(`Cannot restore a file over ${path}.`)
    if (!info || !(await readFile(path)).equals(entry.content)) {
      await writeFile(path, entry.content, { mode: entry.mode })
    }
  } else {
    if (info && !info.isDirectory()) throw new Error(`Cannot restore a directory over ${path}.`)
    if (!info) await mkdir(path, { mode: entry.mode })
    const names = new Set([...entry.children.keys(), ...(await readdir(path))])
    const results = await Promise.allSettled(
      [...names].map((name) => restore(join(path, name), entry.children.get(name), false))
    )
    const failures = results.flatMap((result) =>
      result.status === 'rejected' ? [result.reason] : []
    )
    if (failures.length) throw new AggregateError(failures, 'Generated certificate restore failed.')
  }
  if (process.platform !== 'win32' && (!info || (info.mode & 0o777) !== entry.mode)) {
    await chmod(path, entry.mode)
  }
}

export async function snapshotWebsiteFiles(files: readonly string[], directory?: string) {
  const entries = new Map<string, { entry: Entry | undefined; directory: boolean }>()
  for (const file of files)
    entries.set(file, { entry: await capture(file, false), directory: false })
  if (directory) entries.set(directory, { entry: await capture(directory, true), directory: true })
  return {
    async restore(): Promise<string[]> {
      const paths = [...entries.keys()]
      const results = await Promise.allSettled(
        [...entries].map(([path, { entry, directory }]) => restore(path, entry, directory))
      )
      return paths.filter((_, index) => results[index].status === 'rejected')
    }
  }
}

export async function removeWebsiteFiles(paths: readonly string[]): Promise<string[]> {
  const failures: string[] = []
  for (const path of paths) {
    try {
      if (await inspect(path)) {
        await removeByRoot(path)
        if (await inspect(path)) failures.push(path)
      }
    } catch {
      failures.push(path)
    }
  }
  return failures
}
