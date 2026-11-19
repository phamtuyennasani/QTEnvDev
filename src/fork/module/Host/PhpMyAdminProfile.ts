import { join, resolve } from 'node:path'
import { lstat, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { fetchHostList } from './HostFile'

export type PhpMyAdminTarget = { engine: 'mysql' | 'mariadb'; version: string; port: number }

export function phpMyAdminProfile(content: string, target: PhpMyAdminTarget) {
  const { engine, version, port } = target
  if ((engine !== 'mysql' && engine !== 'mariadb') || !/^\d+(?:\.\d+){1,3}$/.test(version) ||
      !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('The database did not report a valid local connection target.')
  }
  const text = content.trimEnd().replace(/\?>$/, '').trimEnd()
  if (!/^\s*<\?php\b/.test(text) || text.slice(text.indexOf('<?php') + 5).includes('?>')) {
    throw new Error('phpMyAdmin uses a custom configuration that needs a server entry for this port.')
  }
  const server = 65536 + port
  const start = `// QTEnvDev managed database profile ${server}`
  const end = `// End QTEnvDev managed database profile ${server}`
  const label = `${engine === 'mysql' ? 'MySQL' : 'MariaDB'} ${version} (port ${port})`
  const block = [
    start,
    `$cfg['Servers'][${server}] = [`,
    `    'host' => '127.0.0.1',`,
    `    'port' => '${port}',`,
    `    'auth_type' => 'cookie',`,
    `    'verbose' => '${label}',`,
    `];`,
    end
  ].join('\n')
  const existing = text.indexOf(start)
  if (existing < 0) return { server, content: `${text}\n\n${block}\n` }
  const closing = text.indexOf(end, existing)
  if (closing < 0) throw new Error('The managed phpMyAdmin profile is incomplete.')
  return { server, content: `${text.slice(0, existing)}${block}${text.slice(closing + end.length)}\n` }
}

export async function configurePhpMyAdminProfile(target: PhpMyAdminTarget) {
  const site = resolve(global.Server.BaseDir!, 'www/phpMyAdmin')
  const host = (await fetchHostList()).find((entry) => 'isAppPHPMyAdmin' in entry && entry.isAppPHPMyAdmin === true)
  if (!host || resolve(host.root) !== site || !(await lstat(site)).isDirectory()) {
    throw new Error('The managed phpMyAdmin site was not found.')
  }
  const file = join(site, 'config.inc.php')
  let info
  try { info = await lstat(file) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  if (info && !info.isFile()) throw new Error('The phpMyAdmin configuration is not a regular file.')
  const original = info ? await readFile(file, 'utf8') : '<?php\n'
  const update = phpMyAdminProfile(original, target)
  if (original !== update.content) {
    const temp = join(site, `.qtenvdev-${randomUUID()}.tmp`)
    try {
      await writeFile(temp, update.content, { flag: 'wx', mode: info?.mode ?? 0o644 })
      await rename(temp, file)
    } finally {
      await rm(temp, { force: true }).catch(() => {})
    }
  }
  return { server: update.server }
}
