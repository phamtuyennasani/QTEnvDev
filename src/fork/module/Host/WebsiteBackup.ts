import { createHash, randomUUID } from 'node:crypto'
import {
  link,
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  rmdir,
  stat,
  unlink,
  writeFile
} from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, sep, win32 } from 'node:path'
import type { AppHost } from '@shared/app'
import { buildSiteHostnames, isDirectProjectSite, isTomcatSite } from '@shared/siteRuntime'
import { makeApacheConf } from '../Apache/Host'
import { makeCaddyConf } from '../Caddy/Host'
import { makeFrankenPHPConf } from '../FrankenPHP/Host'
import { makeNginxConf } from '../Nginx/Host'
import { validateTomcatSite, type TomcatSiteHost } from '../Tomcat/Site'
import { fetchHostList, saveHostList } from './HostFile'

const FORMAT = 'qtenvdev-websites'
const MAX_BACKUP_BYTES = 16 * 1024 * 1024
const MAX_ASSET_BYTES = 512 * 1024
const MAX_HOSTS = 1000
const kinds = ['nginx', 'apache', 'caddy', 'frankenphp', 'rewrite'] as const
type AssetKind = (typeof kinds)[number]
type Assets = Partial<Record<AssetKind, string>>
type Bundle = {
  format: typeof FORMAT
  version: 1
  baseDir: string
  hosts: AppHost[]
  assets: Record<string, Assets>
}
export type WebsiteBackupPreview = {
  token: string
  sites: { id: string; name: string; root: string; type: string }[]
  warnings: string[]
}
export type WebsiteBackupImportResult =
  | { outcome: 'committed'; host: AppHost[]; count: number; warnings: string[] }
  | { outcome: 'unknown'; message: string }

const isMissing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === 'ENOENT'
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && !!value && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string'
const port = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
const safePath = (value: unknown): value is string =>
  text(value) &&
  !/[\u0000-\u001f"<>|]/.test(value) &&
  (isAbsolute(value) || win32.isAbsolute(value))
const id = (value: unknown): value is string | number =>
  typeof value === 'number'
    ? Number.isSafeInteger(value) && value > 0
    : text(value) && /^[A-Za-z0-9]{1,64}$/.test(value) && !reserved.test(value)
const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i
const webName = (value: unknown): value is string =>
  text(value) &&
  value.length <= 253 &&
  /^(?:\[(?:[a-fA-F0-9:.]+)\]|[a-zA-Z0-9](?:[a-zA-Z0-9_.-]*[a-zA-Z0-9])?\.?)$/.test(value)
const legacyBasename = (value: string) =>
  webName(value) && !reserved.test(value) && !value.includes(':')
const vhost = (host: AppHost) => !host.type || host.type === 'php'
const assetPath = (host: AppHost, kind: AssetKind) =>
  join(global.Server.BaseDir!, 'vhost', kind, `${host.id}.conf`)
const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)
const fixedPath = (value: string) => value.replaceAll('\\', '/').replace(/\/$/, '')
function validateSelectedPath(file: unknown): asserts file is string {
  if (!text(file) || !isAbsolute(file) || file.includes('\0'))
    throw new Error('Choose an absolute backup file path.')
}

async function readBounded(path: string, limit: number, optional = false) {
  let handle
  try {
    if (!(await lstat(path)).isFile()) throw new Error(`Backup requires a regular file: ${path}`)
    handle = await open(path, 'r')
  } catch (error) {
    if (optional && isMissing(error)) return undefined
    throw error
  }
  try {
    const info = await handle.stat()
    if (info.size > limit || !info.isFile())
      throw new Error(`Backup file is too large or invalid: ${path}`)
    const buffer = Buffer.alloc(info.size + 1)
    let offset = 0
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, null)
      if (!bytesRead) break
      offset += bytesRead
    }
    if (offset !== info.size) throw new Error(`Backup file changed while being read: ${path}`)
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      buffer.subarray(0, offset)
    )
  } finally {
    await handle.close()
  }
}

function validateHost(value: unknown, index: number): AppHost {
  const invalid = (detail: string): never => {
    throw new Error(`Website ${index + 1}: ${detail}`)
  }
  if (!object(value)) throw new Error(`Website ${index + 1} must be an object.`)
  if (!id(value.id)) invalid('invalid identifier.')
  if (!webName(value.name)) invalid('invalid hostname.')
  if (
    !text(value.alias) ||
    value.alias.split('\n').some((item) => item.trim() && !webName(item.trim()))
  )
    invalid('invalid aliases.')
  if (!safePath(value.root)) invalid('invalid project path.')
  if (
    value.type != null &&
    (!text(value.type) ||
      !['php', 'tomcat', 'java', 'node', 'go', 'python', ''].includes(value.type))
  )
    invalid('unknown runtime.')
  const ssl = value.ssl
  if (
    typeof value.useSSL !== 'boolean' ||
    (value.autoSSL != null && typeof value.autoSSL !== 'boolean') ||
    !object(ssl) ||
    ![ssl.cert, ssl.key].every((path) => path === '' || safePath(path))
  ) {
    invalid('invalid TLS settings.')
  }
  if (!object(value.port)) invalid('invalid ports.')
  const ports = value.port as Record<string, unknown>
  for (const kind of ['nginx', 'apache', 'caddy', 'frankenphp', 'tomcat']) {
    for (const key of [kind, `${kind}_ssl`]) {
      if (hasOwn(ports, key) && !port(ports[key])) invalid(`invalid ${key} port.`)
    }
  }
  if (!object(value.nginx) || !text(value.nginx.rewrite)) invalid('invalid rewrite settings.')
  const stringFields = [
    'url',
    'mark',
    'bookmark',
    'projectName',
    'startCommand',
    'subType',
    'envVarType',
    'envVar',
    'envFile',
    'jdkDir',
    'jarDir',
    'tomcatDir',
    'nodeDir',
    'pythonDir',
    'bin',
    'phpVersionFull'
  ]
  if (stringFields.some((key) => value[key] != null && !text(value[key])))
    invalid('invalid website or project settings.')
  if (value.isTop != null && typeof value.isTop !== 'boolean') invalid('invalid pin setting.')
  if (
    value.phpVersion != null &&
    value.phpVersion !== 0 &&
    (!Number.isSafeInteger(value.phpVersion) || Number(value.phpVersion) < 0)
  )
    invalid('invalid PHP version.')
  if (value.projectPort != null && value.projectPort !== 0 && !port(value.projectPort))
    invalid('invalid project port.')
  if (value.reverseProxy != null) {
    if (!Array.isArray(value.reverseProxy)) invalid('invalid reverse proxy settings.')
    for (const entry of value.reverseProxy as unknown[]) {
      if (
        !object(entry) ||
        !text(entry.path) ||
        !/^\/[A-Za-z0-9_./~%-]*$/.test(entry.path) ||
        !text(entry.url) ||
        !/^https?:\/\/[^\s"'{};\\]+$/i.test(entry.url) ||
        !URL.canParse(entry.url)
      ) {
        invalid('invalid reverse proxy entry.')
      }
    }
  }
  if (value.tomcat != null) {
    if (
      !object(value.tomcat) ||
      !Array.isArray(value.tomcat.contexts) ||
      !object(value.tomcat.rewrite) ||
      typeof value.tomcat.rewrite.enabled !== 'boolean' ||
      !text(value.tomcat.rewrite.content) ||
      value.tomcat.contexts.some(
        (entry) =>
          !object(entry) || !text(entry.id) || !text(entry.path) || !safePath(entry.docBase)
      )
    ) {
      invalid('invalid Tomcat site settings.')
    }
  }
  const host = value as unknown as AppHost
  host.type ||= 'php'
  host.autoSSL ??= false
  host.url ??= ''
  if (host.type === 'java' && host.subType === 'other') host.type = 'tomcat'
  if (isDirectProjectSite(host) && !port(host.projectPort))
    invalid('project requires a listening port.')
  if (vhost(host)) {
    for (const key of ['nginx', 'apache', 'caddy'] as const) {
      host.port[key] ??= 80
      host.port[`${key}_ssl`] ??= 443
    }
  }
  return host
}

function endpoints(host: AppHost) {
  const names = buildSiteHostnames(host).map((name) => name.toLowerCase().replace(/\.$/, ''))
  if (isTomcatSite(host)) return [`tomcat:${names[0]}`]
  if (isDirectProjectSite(host)) return [`project:${host.projectPort}`]
  if (!vhost(host)) return []
  return names.flatMap((name) =>
    ['nginx', 'apache', 'caddy', 'frankenphp'].flatMap((kind) => {
      const ports = host.port as Record<string, number | undefined>
      const http = ports[kind] ?? (kind === 'frankenphp' ? ports.caddy : undefined) ?? 80
      const https =
        ports[kind + '_ssl'] ?? (kind === 'frankenphp' ? ports.caddy_ssl : undefined) ?? 443
      return [`${kind}:${name}:${http}`, ...(host.useSSL ? [`${kind}:${name}:${https}`] : [])]
    })
  )
}

const pathExists = async (path: string) =>
  lstat(path).then(
    () => true,
    (error) => {
      if (isMissing(error)) return false
      throw error
    }
  )
const isFile = async (path: string) =>
  stat(path).then(
    (value) => value.isFile(),
    (error) => {
      if (isMissing(error)) return false
      throw error
    }
  )

async function prepareImport(file: string) {
  validateSelectedPath(file)
  const current = await fetchHostList(false)
  const source = await readBounded(file, MAX_BACKUP_BYTES)
  const data: unknown = JSON.parse(source!.replace(/^\uFEFF/, ''))
  const legacy = Array.isArray(data)
  if (
    !legacy &&
    (!object(data) ||
      data.format !== FORMAT ||
      data.version !== 1 ||
      !Array.isArray(data.hosts) ||
      !object(data.assets) ||
      !safePath(data.baseDir))
  ) {
    throw new Error('Unrecognized website backup format.')
  }
  const bundle = legacy ? undefined : (data as Bundle)
  const records = legacy ? data : bundle!.hosts
  if (!records.length || records.length > MAX_HOSTS)
    throw new Error(`Choose a backup containing 1 to ${MAX_HOSTS} websites.`)
  const hosts = records.map(validateHost)
  const assignedIds = new Set(current.map((item) => String(item.id).toLowerCase()))
  const occupied = new Set(current.flatMap(endpoints))
  const assets = new Map<string, string>()
  const warnings: string[] = []
  const sourceHashes = createHash('sha256').update(source!)
  const sourceBase = bundle && fixedPath(bundle.baseDir)
  const targetBase = fixedPath(global.Server.BaseDir!)
  const rebase = (value: string) =>
    sourceBase && sourceBase !== targetBase
      ? value.replaceAll(sourceBase + '/', targetBase + '/')
      : value
  let bytes = Buffer.byteLength(source!)

  if (bundle) {
    const validIds = new Set(hosts.filter(vhost).map((host) => String(host.id)))
    for (const [key, entries] of Object.entries(bundle.assets)) {
      if (
        !validIds.has(key) ||
        !object(entries) ||
        Object.entries(entries).some(
          ([kind, content]) =>
            !kinds.includes(kind as AssetKind) ||
            !text(content) ||
            Buffer.byteLength(content) > MAX_ASSET_BYTES
        )
      ) {
        throw new Error(`Invalid configuration attachment for website ${key}.`)
      }
    }
  }
  const seenNames = new Map<string, number>()
  for (const host of hosts) {
    const name = host.name.toLowerCase()
    seenNames.set(name, (seenNames.get(name) ?? 0) + 1)
  }
  for (const host of hosts) {
    const key = String(host.id).toLowerCase()
    if (assignedIds.has(key)) throw new Error(`Website identifier already exists: ${host.id}.`)
    assignedIds.add(key)
    if (
      !(await stat(host.root).then(
        (value) => value.isDirectory(),
        () => false
      ))
    ) {
      warnings.push(`${host.name}: project folder is unavailable. Update its path after import.`)
    }
    const certificateMissing =
      host.useSSL &&
      (!host.ssl.cert ||
        !host.ssl.key ||
        !(await isFile(host.ssl.cert)) ||
        !(await isFile(host.ssl.key)))
    if (certificateMissing) {
      host.useSSL = false
      warnings.push(
        `${host.name}: TLS files are unavailable. The imported site will use HTTP until you configure TLS.`
      )
    }
    if (isTomcatSite(host)) {
      const tomcat = host as TomcatSiteHost
      await validateTomcatSite(tomcat, [...current, ...hosts] as TomcatSiteHost[], {
        requireExistingPaths: false,
        validateCertificateFiles: false
      })
      for (const context of tomcat.tomcat?.contexts ?? []) {
        if (!(await pathExists(context.docBase)))
          warnings.push(`${host.name}: Context ${context.path} needs its deployment path.`)
      }
    }
    for (const endpoint of new Set(endpoints(host))) {
      if (occupied.has(endpoint))
        throw new Error(`${host.name}: a listening endpoint is already in use (${endpoint}).`)
      occupied.add(endpoint)
    }
    for (const kind of kinds) {
      const path = assetPath(host, kind)
      if (await pathExists(path))
        throw new Error(`Website configuration destination already exists: ${path}`)
    }
    if (!vhost(host)) continue
    const supplied =
      bundle && hasOwn(bundle.assets, String(host.id)) ? bundle.assets[String(host.id)] : {}
    for (const kind of kinds) {
      if (
        legacy &&
        legacyBasename(host.name) &&
        (kind === 'nginx' || kind === 'apache' || kind === 'rewrite')
      ) {
        const path = join(dirname(file), `${host.name}.${kind}.conf`)
        const content = await readBounded(path, MAX_ASSET_BYTES, true)
        if (content !== undefined) {
          if (seenNames.get(host.name.toLowerCase())! > 1)
            throw new Error(
              `${host.name}: legacy sidecars cannot distinguish websites with the same hostname.`
            )
          bytes += Buffer.byteLength(content)
          if (bytes > MAX_BACKUP_BYTES) throw new Error('Combined backup files are too large.')
          sourceHashes.update(JSON.stringify([host.id, kind, content]))
          supplied[kind] = content
        }
      }
      if (supplied[kind] !== undefined && (!certificateMissing || kind === 'rewrite')) {
        assets.set(assetPath(host, kind), rebase(supplied[kind]!))
      }
    }
    const stage = async (path: string, content: string) => {
      if (!assets.has(path)) assets.set(path, content)
    }
    if (!assets.has(assetPath(host, 'nginx')) || !assets.has(assetPath(host, 'rewrite')))
      await makeNginxConf(host, stage)
    if (!assets.has(assetPath(host, 'apache'))) await makeApacheConf(host, stage)
    if (!assets.has(assetPath(host, 'caddy'))) await makeCaddyConf(host, stage)
    if (!assets.has(assetPath(host, 'frankenphp'))) await makeFrankenPHPConf(host, stage)
  }
  const stored = JSON.stringify(current)
  const preview: WebsiteBackupPreview = {
    token: sourceHashes
      .update(JSON.stringify([stored, hosts, [...assets], warnings]))
      .digest('hex'),
    sites: hosts.map((host) => ({
      id: String(host.id),
      name: host.name,
      root: host.root,
      type: host.type!
    })),
    warnings
  }
  return { preview, current, stored, hosts, assets }
}

export async function previewWebsiteBackup(file: string): Promise<WebsiteBackupPreview> {
  return (await prepareImport(file)).preview
}

export async function exportWebsiteBackup(file: string) {
  validateSelectedPath(file)
  const baseDir = await realpath(global.Server.BaseDir!)
  const outputDir = await realpath(dirname(file))
  const fromBase = relative(baseDir, outputDir)
  if (
    !fromBase ||
    (!isAbsolute(fromBase) && fromBase !== '..' && !fromBase.startsWith('..' + sep))
  ) {
    throw new Error('Save website backups outside the application data directory.')
  }
  const hosts = (await fetchHostList(false)).map(validateHost)
  if (!hosts.length || hosts.length > MAX_HOSTS)
    throw new Error(`Export requires 1 to ${MAX_HOSTS} saved websites.`)
  const bundle: Bundle = {
    format: FORMAT,
    version: 1,
    baseDir: global.Server.BaseDir!,
    hosts,
    assets: Object.create(null)
  }
  const warnings: string[] = []
  let bytes = 0
  for (const host of hosts.filter(vhost)) {
    const attachments: Assets = {}
    for (const kind of kinds) {
      const content = await readBounded(assetPath(host, kind), MAX_ASSET_BYTES, true)
      if (content === undefined) continue
      bytes += Buffer.byteLength(content)
      if (bytes > MAX_BACKUP_BYTES)
        throw new Error('Website configuration files exceed the backup size limit.')
      attachments[kind] = content
    }
    if (kinds.some((kind) => attachments[kind] === undefined))
      warnings.push(`${host.name}: missing configuration files will be generated on import.`)
    bundle.assets[String(host.id)] = attachments
  }
  const content = JSON.stringify(bundle, null, 2)
  if (Buffer.byteLength(content) > MAX_BACKUP_BYTES)
    throw new Error('The website backup exceeds the size limit.')
  const temporary = file + '.' + randomUUID() + '.tmp'
  try {
    await writeFile(temporary, content, { flag: 'wx', mode: 0o600 })
    await rename(temporary, file)
  } finally {
    await unlink(temporary).catch(() => undefined)
  }
  return { count: hosts.length, warnings }
}

const commitIO = { saveHostList, unlink }

export async function importWebsiteBackup(
  file: string,
  token: string,
  progress: (message: string) => void,
  io = commitIO
): Promise<WebsiteBackupImportResult> {
  progress('Checking the backup and its destinations…')
  const plan = await prepareImport(file)
  if (token !== plan.preview.token)
    throw new Error('The backup or saved websites changed. Review the backup again.')
  const folders: string[] = []
  const temporary = new Map<string, string>()
  const added: string[] = []
  try {
    const vhostDir = join(global.Server.BaseDir!, 'vhost')
    const dirs = new Set([
      vhostDir,
      join(vhostDir, 'logs'),
      ...[...plan.assets.keys()].map(dirname)
    ])
    if (plan.assets.size) {
      for (const folder of dirs) {
        const info = await lstat(folder).catch((error) => {
          if (isMissing(error)) return undefined
          throw error
        })
        if (info && !info.isDirectory())
          throw new Error(`Invalid configuration directory: ${folder}`)
        if (!info) {
          await mkdir(folder)
          folders.push(folder)
        }
      }
    }
    progress('Staging website configuration…')
    for (const [path, content] of plan.assets) {
      const temp = path + '.' + randomUUID() + '.tmp'
      const handle = await open(temp, 'wx', 0o600)
      temporary.set(path, temp)
      try {
        await handle.writeFile(content)
      } finally {
        await handle.close()
      }
    }
    progress('Writing website configuration…')
    for (const [path, temp] of temporary) {
      await link(temp, path)
      added.push(path)
    }
    if (JSON.stringify(await fetchHostList(false)) !== plan.stored) {
      throw new Error('Saved websites changed during import. Review the backup again.')
    }
    const hosts = [...plan.current, ...plan.hosts].sort(
      (left, right) => Number(Boolean(right.isTop)) - Number(Boolean(left.isTop))
    )
    await io.saveHostList(hosts)
    return {
      outcome: 'committed',
      host: hosts,
      count: plan.hosts.length,
      warnings: plan.preview.warnings
    }
  } catch (error) {
    const rollback = await Promise.allSettled(added.map((path) => io.unlink(path)))
    const remaining = added.filter((_, index) => {
      const result = rollback[index]
      return result.status === 'rejected' && !isMissing(result.reason)
    })
    if (remaining.length) {
      return {
        outcome: 'unknown',
        message: `The website import failed (${String(error)}). These configuration files could not be rolled back: ${remaining.join(', ')}`
      }
    }
    throw error
  } finally {
    await Promise.allSettled([...temporary.values()].map((path) => unlink(path)))
    for (const folder of folders.reverse()) await rmdir(folder).catch(() => undefined)
  }
}
