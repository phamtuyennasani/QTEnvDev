import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { AppHost } from '../src/shared/app'
import { fetchHostList, saveHostList } from '../src/fork/module/Host/HostFile'
import * as NginxRewriteTemplates from '../src/fork/module/Host/NginxRewriteTemplates'
import { parkSubdirectories } from '../src/fork/module/Host/ParkSubdirectories'
import * as RestoreConfig from '../src/fork/module/Host/RestoreConfig'
import * as Transaction from '../src/fork/module/Host/Transaction'
import {
  exportWebsiteBackup,
  importWebsiteBackup,
  previewWebsiteBackup
} from '../src/fork/module/Host/WebsiteBackup'
import { WebsiteBackupController } from '../src/render-next/websites/WebsiteBackupController'
import { WebsiteOutcomeUnknown } from '../src/render-next/websites/types'
import { isWebsiteForkTransaction, WebsiteForkQueue } from '../src/main/core/WebsiteForkQueue'
import { ForkPromise } from '../src/shared/ForkPromise'
import { loadIsolated } from './helpers/load-isolated'

const temp = await mkdtemp(join(tmpdir(), 'pqt-website-backup-'))
const previousServer = global.Server
const base = join(temp, 'app')
const templates = join(temp, 'assets')
const root = join(temp, 'project')
const source = join(temp, 'legacy.json')
const exported = join(temp, 'website-backup.json')
const hostFile = join(base, 'host.json')
const configPath = (kind: string, id: string) =>
  join(global.Server.BaseDir!, 'vhost', kind, id + '.conf')
const record = (id: string | number, name: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name,
  root,
  alias: '',
  useSSL: false,
  autoSSL: false,
  ssl: { cert: '', key: '' },
  port: { nginx: 80, nginx_ssl: 443, apache: 80, apache_ssl: 443, caddy: 80, caddy_ssl: 443 },
  nginx: { rewrite: 'try_files $uri /index.php;' },
  type: 'php',
  ...overrides
})
const customNginx = '\uFEFF# custom vhost, preserved byte for byte\n'
const noop = () => undefined
const noWrite = async () => {
  throw new Error('fixture host-list write failed')
}
const file = (path: string, value: unknown) => writeFile(path, JSON.stringify(value))
const assertAbsent = (path: string) => assert.rejects(readFile(path), { code: 'ENOENT' })

async function verifyRegularWrites() {
  const live = record(701, 'transaction.localhost') as AppHost
  const other = record(702, 'sibling.localhost') as AppHost
  const dirs = ['nginx', 'apache', 'caddy', 'frankenphp', 'rewrite']
  await Promise.all(dirs.map((kind) => mkdir(join(base, 'vhost', kind), { recursive: true })))
  await mkdir(join(root, 'good'), { recursive: true })
  await mkdir(join(root, 'failed'), { recursive: true })
  await file(hostFile, [live, other])
  let failCommit = false
  const { Host } = await loadIsolated(
    'src/fork/module/Host/index.ts',
    {
      '../Base': { Base: class {} },
      '@lang/runtime': { I18nT: (key: string) => key },
      '../../Fn': {},
      '@shared/ForkPromise': { ForkPromise },
      '../Caddy/Host': {},
      '../Apache/Host': {},
      '../FrankenPHP/Host': {},
      '../Nginx/Host': {},
      './Host': {},
      './Task': {},
      './HostFile': {
        fetchHostList,
        saveHostList: (list: AppHost[]) => (failCommit ? noWrite() : saveHostList(list))
      },
      './WebsiteBackup': {},
      './NginxRewriteTemplates': NginxRewriteTemplates,
      './ParkSubdirectories': { parkSubdirectories },
      './RestoreConfig': RestoreConfig,
      '../Tomcat/Site': {},
      '@shared/utils': { isWindows: () => false, isMacOS: () => false },
      '@shared/PlatFormConst': {},
      '@shared/WindowsSystemPaths': {},
      './SystemHostsBlock': {},
      './UnixHosts': {},
      '@shared/OperationTiming': {},
      '@shared/WindowsDnsRefresh': {},
      './Transaction': Transaction
    },
    { global }
  )
  const host = new Host()
  const siteFile = (kind: string, id: number) => join(base, 'vhost', kind, id + '.conf')
  const certDir = join(base, 'CA', String(live.id))
  const certFile = join(certDir, 'certificate.key')
  const originalCert = Buffer.from([0xff, 0x0a, 0x00])
  await mkdir(certDir, { recursive: true })
  await writeFile(certFile, originalCert, { mode: 0o600 })
  await Promise.all(dirs.map((kind) => writeFile(siteFile(kind, live.id), kind)))

  host._editVhost = async () => {
    await writeFile(siteFile('nginx', live.id), 'partial change')
    await writeFile(certFile, 'replacement certificate')
    await writeFile(join(certDir, 'new-file'), 'partial change')
    throw new Error('fixture server file failed')
  }
  const originalList = await readFile(hostFile)
  await assert.rejects(
    Promise.resolve(host.handleHost({ ...live, mark: 'changed' }, 'edit', live)),
    /fixture server file failed/
  )
  assert.equal(await readFile(siteFile('nginx', live.id), 'utf8'), 'nginx')
  assert.deepEqual(await readFile(certFile), originalCert)
  await assertAbsent(join(certDir, 'new-file'))
  assert.deepEqual(await readFile(hostFile), originalList)

  host._addVhost = async (item: AppHost) => {
    await writeFile(siteFile('nginx', item.id), item.name)
  }
  failCommit = true
  const unsaved = record(703, 'unsaved.localhost') as AppHost
  await assert.rejects(
    Promise.resolve(host.handleHost(unsaved, 'add')),
    /fixture host-list write failed/
  )
  await assertAbsent(siteFile('nginx', unsaved.id))
  const log = join(base, 'vhost', 'logs', live.id + '.log')
  await mkdir(join(base, 'vhost', 'logs'), { recursive: true })
  await writeFile(log, 'existing log')
  await assert.rejects(
    Promise.resolve(host.handleHost(live, 'del', live)),
    /fixture host-list write failed/
  )
  assert.equal(await readFile(siteFile('apache', live.id), 'utf8'), 'apache')
  assert.deepEqual(await readFile(certFile), originalCert)
  assert.equal(await readFile(log, 'utf8'), 'existing log')
  assert.deepEqual(await readFile(hostFile), originalList)

  failCommit = false
  let failedPath = ''
  host._addVhost = async (item: AppHost) => {
    const config = siteFile('nginx', item.id)
    if (item.projectName === 'failed') {
      failedPath = config
      // Force a rollback error without depending on the test user's permissions.
      await mkdir(config)
      throw new Error('fixture parked write failed')
    }
    await writeFile(config, item.name)
  }
  const parked = await host.handleHost(live, 'park', live)
  assert.equal(parked.outcome, 'unknown')
  assert.equal(parked.parked.count, 1)
  assert.match(parked.parked.warnings.join('\n'), /fixture parked write failed/)
  assert.ok(parked.parked.warnings.some((warning: string) => warning.includes(failedPath)))
  assert.deepEqual(
    (await fetchHostList(false)).map((item) => item.name),
    ['good.transaction.localhost', live.name, other.name]
  )

  const nginx = siteFile('nginx', live.id)
  const rewrite = siteFile('rewrite', live.id)
  const customRewrite = Buffer.from('\uFEFF# Local rewrite\r\n', 'utf8')
  await writeFile(rewrite, customRewrite)
  await unlink(nginx)
  assert.equal(await host.restoreConfig(live.id, 'nginx'), 'created')
  assert.match(await readFile(nginx, 'utf8'), /transaction\.localhost/)
  assert.deepEqual(await readFile(rewrite), customRewrite)
  assert.equal(await host.restoreConfig(live.id, 'rewrite'), 'exists')
  assert.deepEqual(await readFile(rewrite), customRewrite)

  const customVhost = '# Locally modified Nginx configuration\r\n'
  await writeFile(nginx, customVhost)
  await unlink(rewrite)
  assert.equal(await host.restoreConfig(live.id, 'rewrite'), 'created')
  assert.equal(await readFile(rewrite, 'utf8'), live.nginx.rewrite)
  assert.equal(await host.restoreConfig(live.id, 'nginx'), 'exists')
  assert.equal(await readFile(nginx, 'utf8'), customVhost)

  for (const kind of ['apache', 'caddy', 'frankenphp']) {
    const path = siteFile(kind, live.id)
    await unlink(path)
    assert.equal(await host.restoreConfig(live.id, kind), 'created')
    assert.match(await readFile(path, 'utf8'), /transaction\.localhost/)
  }

  await unlink(nginx)
  const attempts = await Promise.all([
    RestoreConfig.restoreWebsiteConfig(base, live, 'nginx'),
    RestoreConfig.restoreWebsiteConfig(base, live, 'nginx')
  ])
  assert.deepEqual(attempts.sort(), ['created', 'exists'])
  assert.match(await readFile(nginx, 'utf8'), /transaction\.localhost/)
  assert.ok(!(await readdir(join(base, 'vhost', 'nginx'))).some((name) => name.endsWith('.tmp')))

  await mkdir(siteFile('nginx', other.id))
  await assert.rejects(Promise.resolve(host.restoreConfig(other.id, 'nginx')), /not a regular file/)
  await assert.rejects(Promise.resolve(host.restoreConfig(99999, 'nginx')), /saved PHP or static/)
  await assert.rejects(Promise.resolve(host.restoreConfig('../escape', 'nginx')), /Invalid website/)
  await assert.rejects(Promise.resolve(host.restoreConfig(live.id, 'logs')), /Invalid website/)

  const legacy = record('Aa70c8Cj5miL3', 'legacy.restore.localhost')
  await file(hostFile, [...(await fetchHostList(false)), legacy])
  assert.equal(await host.restoreConfig(legacy.id, 'nginx'), 'created')
  assert.match(
    await readFile(configPath('nginx', String(legacy.id)), 'utf8'),
    /legacy\.restore\.localhost/
  )
  await assertAbsent(configPath('rewrite', String(legacy.id)))
}

try {
  await Promise.all([mkdir(base), mkdir(root), mkdir(templates)])
  const platform =
    process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux'
  const destination = join(templates, 'tmpl')
  await cp(resolve('static/tmpl', platform), destination, { recursive: true })
  for (const name of ['FrankenphpVhost', 'FrankenphpVhostSSL']) {
    await cp(resolve('static/tmpl', name), join(destination, name))
  }
  global.Server = { BaseDir: base, Static: templates } as typeof global.Server
  await verifyRegularWrites()
  await rm(join(base, 'vhost'), { recursive: true })
  await rm(join(base, 'CA'), { recursive: true })
  const legacy = record('Aa70c8Cj5miL3', 'old.localhost')
  const current = record(9, 'live.localhost')
  await file(hostFile, [current])
  const original = await readFile(hostFile, 'utf8')
  await file(source, [legacy, record('../escape', 'bad.localhost')])
  await assert.rejects(previewWebsiteBackup(source), /invalid identifier/)
  assert.equal(await readFile(hostFile, 'utf8'), original)
  await assert.rejects(readdir(join(base, 'vhost')), { code: 'ENOENT' })

  await file(source, [record(10, 'new.localhost', { alias: current.name })])
  await assert.rejects(previewWebsiteBackup(source), /listening endpoint/)
  await file(source, [legacy])
  const sidecar = join(temp, 'old.localhost.nginx.conf')
  await writeFile(sidecar, customNginx)
  const preview = await previewWebsiteBackup(source)
  assert.deepEqual(
    preview.sites.map(({ id, name }) => [id, name]),
    [[legacy.id, legacy.name]]
  )
  assert.equal(
    await readFile(hostFile, 'utf8'),
    original,
    'preview must not migrate the existing plaintext host list'
  )
  await writeFile(sidecar, 'changed after preview')
  await assert.rejects(importWebsiteBackup(source, preview.token, noop), /changed/)
  await writeFile(sidecar, customNginx)

  const orphan = configPath('caddy', String(legacy.id))
  await mkdir(join(base, 'vhost', 'caddy'), { recursive: true })
  await writeFile(orphan, 'existing config')
  await assert.rejects(
    importWebsiteBackup(source, preview.token, noop),
    /destination already exists/
  )
  assert.equal(await readFile(orphan, 'utf8'), 'existing config')
  await unlink(orphan)
  await assert.rejects(
    importWebsiteBackup(source, preview.token, noop, { saveHostList: noWrite, unlink }),
    /fixture host-list write failed/
  )
  assert.equal(await readFile(hostFile, 'utf8'), original)
  await Promise.all(
    ['nginx', 'apache', 'caddy', 'frankenphp', 'rewrite'].map((kind) =>
      assertAbsent(configPath(kind, String(legacy.id)))
    )
  )

  let failedPath = ''
  const unknown = await importWebsiteBackup(source, preview.token, noop, {
    saveHostList: noWrite,
    unlink: async (path) => {
      if (path === configPath('nginx', String(legacy.id))) {
        failedPath = path
        throw new Error('fixture rollback failure')
      }
      await unlink(path)
    }
  })
  assert.equal(unknown.outcome, 'unknown')
  assert.ok(unknown.outcome === 'unknown' && unknown.message.includes(failedPath))
  assert.equal(await readFile(failedPath, 'utf8'), customNginx)
  assert.equal(await readFile(hostFile, 'utf8'), original)
  await unlink(failedPath)
  const messages: string[] = []
  const committed = await importWebsiteBackup(source, preview.token, (message) =>
    messages.push(message)
  )
  assert.equal(committed.outcome, 'committed')
  assert.equal(messages.length, 3)
  assert.equal(await readFile(configPath('nginx', String(legacy.id)), 'utf8'), customNginx)
  assert.match(await readFile(configPath('apache', String(legacy.id)), 'utf8'), /old\.localhost/)
  assert.match(await readFile(configPath('rewrite', String(legacy.id)), 'utf8'), /try_files/)
  assert.deepEqual(
    (await fetchHostList(false)).map((host) => host.id),
    [9, legacy.id]
  )
  await assert.rejects(previewWebsiteBackup(source), /identifier already exists/)

  const { warnings } = await exportWebsiteBackup(exported)
  assert.ok(warnings.some((message) => message.includes(current.name)))
  const fresh = join(temp, 'restored')
  await mkdir(fresh)
  global.Server.BaseDir = fresh
  const restore = await previewWebsiteBackup(exported)
  assert.equal((await importWebsiteBackup(exported, restore.token, noop)).outcome, 'committed')
  assert.equal(await readFile(configPath('nginx', String(legacy.id)), 'utf8'), customNginx)
  const caddy = await readFile(configPath('caddy', String(legacy.id)), 'utf8')
  assert.ok(caddy.includes(fresh.replaceAll('\\', '/')))
  assert.ok(!caddy.includes(base.replaceAll('\\', '/')))
  assert.deepEqual(
    (await fetchHostList()).map((host) => host.id),
    [9, legacy.id]
  )

  const tls = record(11, 'tls.localhost', {
    useSSL: true,
    ssl: { cert: join(temp, 'missing.crt'), key: join(temp, 'missing.key') }
  })
  await file(source, [tls])
  const tlsPreview = await previewWebsiteBackup(source)
  assert.match(tlsPreview.warnings.join('\n'), /use HTTP/)
  const tlsCommit = await importWebsiteBackup(source, tlsPreview.token, noop)
  assert.ok(
    tlsCommit.outcome === 'committed' && !tlsCommit.host.find((host) => host.id === 11)?.useSSL
  )

  await file(source, [record(12, 'stale.localhost')])
  const stale = await previewWebsiteBackup(source)
  await saveHostList([...(await fetchHostList(false)), record(13, 'other.localhost') as AppHost])
  await assert.rejects(importWebsiteBackup(source, stale.token, noop), /changed/)
} finally {
  global.Server = previousServer
  await rm(temp, { recursive: true, force: true })
}

const events: string[] = []
let path = 'chosen-backup.json'
let release = () => {}
let uncertain = false
const controller = new WebsiteBackupController({
  choose: async () => path,
  exportFile: async () => ({ count: 1, warnings: [] }),
  previewFile: async () => ({
    token: 'preview-token',
    sites: [{ id: '1', name: 'site.localhost', root: 'project', type: 'php' }],
    warnings: []
  }),
  importFile: async (file, token, progress) => {
    events.push(file + ':' + token)
    progress('Waiting for a late result', true)
    await new Promise<void>((resolve) => {
      release = resolve
    })
    return uncertain
      ? { outcome: 'unknown', message: 'Cleanup failed' }
      : { outcome: 'committed', count: 1, host: [], warnings: [] }
  },
  exclusive: async (operation) => {
    events.push('exclusive')
    try {
      return await operation()
    } catch (error) {
      assert.ok(error instanceof WebsiteOutcomeUnknown)
      events.push('blocked')
      throw error
    } finally {
      events.push('released')
    }
  },
  reconcile: () => {
    events.push('reconcile')
  },
  afterImport: async () => {
    throw new Error('Server did not reload')
  },
  notice: (message) => {
    events.push(message)
  }
})
assert.equal(await controller.confirmImport(), false)
assert.equal(await controller.chooseBackup(), true)
const first = controller.confirmImport()
assert.equal(first, controller.confirmImport())
assert.equal(first, controller.chooseBackup())
controller.file = 'ignored-after-confirm.json'
await Promise.resolve()
assert.equal(controller.waiting, true)
assert.equal(controller.busy, true)
assert.deepEqual(events, ['exclusive', 'chosen-backup.json:preview-token'])
release()
assert.equal(await first, true)
assert.equal(controller.busy, false)
assert.deepEqual(events.slice(-3), ['reconcile', 'Imported 1 website.', 'released'])
assert.match(controller.warnings.join('\n'), /Server did not reload/)

uncertain = true
path = 'different-backup.json'
assert.equal(await controller.chooseBackup(), true)
const second = controller.confirmImport()
await Promise.resolve()
release()
assert.equal(await second, false)
assert.deepEqual(events.slice(-2), ['blocked', 'released'])
assert.equal(controller.error, 'Cleanup failed')

const { ForkManager } = await loadIsolated('src/main/core/ForkManager.ts', {
  electron: {},
  '@shared/PerformanceDiagnostics': {
    performanceDiagnosticNow: () => 0,
    performanceDiagnosticElapsed: () => 0
  },
  '@shared/WindowsPathDiagnostics': { logWindowsPath: noop },
  '@shared/ServiceStopDiagnostics': {},
  '@shared/StopProcessList': {},
  '@shared/utils': {},
  '@shared/EnvSync': {},
  '@shared/EnvSyncLocal': {},
  '@shared/ForkPromise': { ForkPromise },
  './ServiceProcess': {},
  './HomebrewOperationCoordinator': {},
  './BinVersionCacheBridge': {},
  './BinVersionCachePersistence': {},
  './BinVersionCacheStore': {},
  './EnvSyncBridge': {},
  './EnvSyncCoordinator': {},
  './ForkIdleLifecycle': {},
  './ForkItem': {},
  './ForkWorkerPolicy': {},
  './StopProcessListBridge': {},
  './StopProcessListCache': {},
  './WebsiteForkQueue': { isWebsiteForkTransaction, WebsiteForkQueue },
  './ServiceLifecycle': {
    isServiceLifecycleContextExpired: () => false,
    hasServiceLifecyclePermit: () => false,
    serviceLifecycleAction: () => undefined
  }
})
type Reply = { code: number; msg?: string; outcome?: string; data?: unknown }
function managerFixture() {
  const dispatched: {
    module: string
    action: string
    progress: (reply: Reply) => void
    finish: (reply: Reply) => void
  }[] = []
  const worker = () => ({
    activeTaskCount: 0,
    isPrimary: false,
    send: (module: string, action: string) =>
      new ForkPromise<Reply>((finish, _reject, progress) => {
        dispatched.push({ module, action, progress, finish })
      })
  })
  const manager = Object.assign(Object.create(ForkManager.prototype), {
    websiteForkQueue: new WebsiteForkQueue(),
    serviceLifecycleRequests: new Set(),
    rawLifecycleRequests: new Set(),
    forks: [worker(), worker()]
  })
  return { manager, dispatched }
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))
assert.ok(isWebsiteForkTransaction('host', 'restoreConfig'))
const { manager, dispatched } = managerFixture()
const updates: string[] = []
const importRequest = manager
  .send('host', 'websiteBackupImport', 'fixture-file', 'fixture-token')
  .on((reply: Reply) => updates.push(reply.msg ?? ''))
const tomcatRequest = manager.send('tomcat', 'saveSite')
const orderRequest = manager.send('host', 'reorderHost')
const readRequest = manager.send('host', 'hostList')
assert.deepEqual(
  dispatched.map(({ action }) => action),
  ['hostList']
)
dispatched[0].finish({ code: 0 })
await readRequest
assert.deepEqual(
  dispatched.map(({ action }) => action),
  ['hostList', 'websiteBackupImport']
)
dispatched[1].progress({ code: 200, msg: 'Publishing configs' })
await flush()
assert.deepEqual(updates, ['Publishing configs'])
assert.equal(dispatched.length, 2)
dispatched[1].finish({ code: 1, msg: 'declared failure with rollback' })
assert.equal((await importRequest).msg, 'declared failure with rollback')
await flush()
assert.deepEqual([dispatched[2].module, dispatched[2].action], ['tomcat', 'saveSite'])
dispatched[2].finish({ code: 1, msg: 'Fork process exited', outcome: 'unknown' })
assert.equal((await tomcatRequest).errorCode, 'TOMCAT_SITE_OUTCOME_UNKNOWN')
assert.match((await orderRequest).msg, /previous website write/)
assert.match((await manager.send('host', 'handleHost')).msg, /previous website write/)
assert.equal(dispatched.length, 3, 'Pending writes must not dispatch after transport loss')

const shutdown = managerFixture()
const exporting = shutdown.manager.send('host', 'websiteBackupExport')
const pending = shutdown.manager.send('host', 'writeHosts')
const shutdownFailure = assert.rejects(Promise.resolve(pending), /shutting down/)
await flush()
shutdown.manager.beginServiceLifecycleShutdown()
shutdown.dispatched[0].finish({ code: 0 })
await exporting
await shutdownFailure
assert.equal(shutdown.dispatched.length, 1)

const lostExport = managerFixture()
const lost = lostExport.manager.send('host', 'websiteBackupExport')
const following = lostExport.manager.send('host', 'reorderHost')
await flush()
lostExport.dispatched[0].finish({ code: 1, msg: 'Fork process exited', outcome: 'unknown' })
assert.equal((await lost).msg, 'Fork process exited')
await flush()
assert.equal(lostExport.dispatched[1].action, 'reorderHost')
lostExport.dispatched[1].finish({ code: 0 })
assert.equal((await following).code, 0)

const partialPark = managerFixture()
const parkedWrite = partialPark.manager.send('host', 'handleHost')
const nextWrite = partialPark.manager.send('host', 'reorderHost')
await flush()
const partialResult = { outcome: 'unknown', host: [{ id: 1 }], parked: { count: 1 } }
partialPark.dispatched[0].finish({ code: 0, data: partialResult })
assert.deepEqual((await parkedWrite).data, partialResult)
assert.match((await nextWrite).msg, /previous website write/)
assert.equal(partialPark.dispatched.length, 1)

console.log(
  'Website backup, missing configuration restoration, regular write rollback, partial parking, and cross-worker admission passed.'
)
