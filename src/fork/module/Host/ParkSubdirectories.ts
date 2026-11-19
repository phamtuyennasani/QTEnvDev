import { randomInt } from 'node:crypto'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppHost } from '@shared/app'
import { splitHostAliases } from '@shared/siteRuntime'

const label = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
const validHostname = (name: string) =>
  name.length <= 253 && name.split('.').every((part) => label.test(part))
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

export async function parkSubdirectories(
  parent: AppHost,
  existing: readonly AppHost[],
  create: (host: AppHost) => PromiseLike<unknown>,
  cleanup: (host: AppHost) => PromiseLike<unknown>
) {
  const added: AppHost[] = []
  const warnings: string[] = []
  let entries
  try {
    entries = await readdir(parent.root, { withFileTypes: true })
  } catch (error) {
    return { added, warnings: ['Could not scan project folders: ' + errorText(error)] }
  }

  const ids = new Set(existing.map((host) => String(host.id)).concat(String(parent.id)))
  const names = new Set(
    [...existing, parent]
      .flatMap((host) => [host.name, ...splitHostAliases(host.alias)])
      .map((name) => name.toLowerCase())
  )
  const parentAliases = splitHostAliases(parent.alias)
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue
    const prefix = entry.name.toLowerCase()
    const name = prefix + '.' + parent.name.toLowerCase()
    if (!label.test(prefix) || !validHostname(name)) {
      warnings.push('Skipped ' + entry.name + ': its folder name cannot be used in a hostname.')
      continue
    }
    if (names.has(name)) {
      warnings.push('Skipped ' + name + ': that hostname is already in use.')
      continue
    }
    const aliases = parentAliases
      .map((alias) => prefix + '.' + alias.toLowerCase())
      .filter((alias, index, list) => alias !== name && list.indexOf(alias) === index)
      .filter((alias) => {
        if (validHostname(alias) && !names.has(alias)) return true
        warnings.push('Skipped alias ' + alias + ' for ' + name + ': invalid or already in use.')
        return false
      })
    let id: number
    do {
      id = randomInt(2 ** 46, 2 ** 47 - 1)
    } while (ids.has(String(id)))
    ids.add(String(id))

    const child: AppHost = {
      ...JSON.parse(JSON.stringify(parent)),
      id,
      name,
      alias: aliases.join('\n'),
      projectName: entry.name,
      root: join(parent.root, entry.name),
      isTop: false,
      isSorting: false,
      isAppPHPMyAdmin: false,
      url: '',
      cronJobs: undefined,
      bookmark: undefined,
      useSSL: parent.useSSL && parent.autoSSL,
      ssl: { cert: '', key: '' },
      nginx: { rewrite: '' }
    }
    try {
      await create(child)
      if (child.useSSL && (!child.ssl.cert || !child.ssl.key)) {
        throw new Error('Automatic certificate generation did not complete.')
      }
      added.push(child)
      for (const hostname of [name, ...aliases]) names.add(hostname)
      if (parent.useSSL && !parent.autoSSL) {
        warnings.push(name + ' uses HTTP. Choose a certificate for this hostname to enable HTTPS.')
      }
    } catch (error) {
      warnings.push('Could not add ' + name + ': ' + errorText(error))
      try {
        await cleanup(child)
      } catch (cleanupError) {
        warnings.push('Could not clean up ' + name + ': ' + errorText(cleanupError))
      }
    }
  }

  return { added, warnings }
}
