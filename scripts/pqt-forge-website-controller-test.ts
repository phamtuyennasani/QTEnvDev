import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { reactive } from 'vue'
import { parkSubdirectories } from '../src/fork/module/Host/ParkSubdirectories'
import { WebsiteController } from '../src/render-next/websites/WebsiteController'
import {
  newWebsite,
  normalizeWebsite,
  projectFromHost,
  websiteLinks,
  websiteUrl
} from '../src/render-next/websites/model'
import {
  WebsiteOutcomeUnknown,
  type WebsiteDependencies,
  type WebsiteHost
} from '../src/render-next/websites/types'
import {
  TomcatSiteOutcomeUnknown,
  TomcatSiteSaveOperation
} from '../src/render/components/Host/Tomcat/TomcatSiteSaveOperation'
import type { AppHost } from '../src/shared/app'

const host = Object.assign(newWebsite(), {
  name: 'app.test',
  root: 'C:/Projects/app',
  projectName: 'Application',
  reverseProxy: [{ path: '/api', url: 'http://127.0.0.1:3000' }]
})
let listed: WebsiteHost[] = [host]
let lists = 0
let writes = 0
let fail = false
let unknown = false
let finish: ((hosts: WebsiteHost[]) => void) | undefined
let observedName = ''
const dependencies: WebsiteDependencies = {
  ready: () => true,
  async list() {
    lists++
    return listed
  },
  async validate() {},
  async write(snapshot, _action, _old, progress) {
    writes++
    observedName = snapshot.name
    progress('Issuing local certificate…')
    if (unknown) throw new WebsiteOutcomeUnknown('Unknown result')
    if (fail) throw new Error('Write failed')
    return new Promise((resolve) => {
      finish = resolve
    })
  },
  reconcile() {},
  async afterCommit() {
    throw new Error('Restart failed')
  },
  async open() {},
  async choosePath() {
    return undefined
  },
  async reveal() {},
  logFiles() {
    return []
  },
  vhostFiles() {
    return []
  },
  notice() {}
}
const controller = reactive(new WebsiteController(dependencies))
const refresh = controller.refresh()
assert.equal(refresh, controller.refresh())
assert.equal(await refresh, true)
assert.equal(lists, 1)
assert.equal(controller.projects[0].domain, 'app.test')
listed = []
assert.equal(await controller.refresh(), true)
assert.equal(controller.projects.length, 0)
const pending = controller.save(host)
assert.equal(await controller.save(host), false)
await Promise.resolve()
await Promise.resolve()
await Promise.resolve()
assert.equal(writes, 1)
assert.equal(controller.operation?.status, 'running')
assert.equal(controller.operation?.message, 'Issuing local certificate…')
host.name = 'mutated.test'
assert.equal(observedName, 'app.test')
listed = [{ ...host, name: 'app.test' }]
finish?.(listed)
assert.equal(await pending, true)
assert.equal(controller.saving, false)
assert.equal(controller.operation?.status, 'success')
assert.match(controller.operation?.warnings[0] || '', /Restart failed/)
assert.equal(controller.projects[0].domain, 'app.test')
fail = true
assert.equal(await controller.save(host), false)
assert.equal(controller.operation?.status, 'failed')
assert.equal(controller.saving, false)
fail = false
listed = []
const retry = controller.save(host)
await Promise.resolve()
await Promise.resolve()
await Promise.resolve()
await Promise.resolve()
listed = [host]
finish?.(listed)
assert.equal(await retry, true)
const project = projectFromHost(host)
const beforeRemoval = writes
assert.equal(await controller.remove(project, 'wrong'), false)
assert.equal(writes, beforeRemoval)
const removal = controller.remove(project, project.domain)
await Promise.resolve()
await Promise.resolve()
await Promise.resolve()
finish?.([])
assert.equal(await removal, true)
assert.equal(controller.projects.length, 0)
listed = []
unknown = true
assert.equal(await controller.save(host), false)
assert.equal(controller.operation?.status, 'unknown')
const beforeReplay = writes
assert.equal(await controller.save(host), false)
assert.equal(writes, beforeReplay)
await controller.refresh()
assert.equal(await controller.save(host), false)
assert.equal(writes, beforeReplay)
assert.throws(() => normalizeWebsite({ ...host, name: 'app.test/path' }))
assert.throws(() => normalizeWebsite({ ...host, name: 'app.test:8080' }))
assert.throws(() => normalizeWebsite({ ...host, name: 'app.test', useSSL: true, autoSSL: false }))
const preserved = normalizeWebsite({
  ...host,
  name: 'APP.test',
  alias: 'www.app.test\nwww.app.test',
  nginx: { rewrite: 'existing rewrite' },
  port: { ...host.port, nginx: 8088 }
})
assert.equal(preserved.name, 'app.test')
assert.equal(preserved.alias, 'www.app.test')
assert.equal(preserved.nginx.rewrite, 'existing rewrite')
assert.equal(websiteUrl(preserved), 'http://app.test:8088/')
assert.equal(
  websiteUrl({
    ...preserved,
    useSSL: true,
    ssl: { cert: 'fixture.crt', key: 'fixture.key' },
    port: { ...preserved.port, nginx_ssl: 8443 }
  }),
  'https://app.test:8443/'
)
assert.equal(websiteUrl({ ...preserved, useSSL: true }), 'http://app.test:8088/')
assert.equal(
  websiteUrl({ ...preserved, type: 'node', useSSL: true, projectPort: 3111 }),
  'http://127.0.0.1:3111/'
)
assert.equal(websiteLinks({ ...preserved, type: 'node', projectPort: undefined }).length, 0)
assert(
  websiteLinks({ ...preserved, alias: 'api.app.test\nuser@elsewhere.test' }).some(
    (link) => link.url === 'http://api.app.test:8088/'
  )
)
assert(
  websiteLinks({ ...preserved, alias: 'api.app.test\nuser@elsewhere.test' }).every(
    (link) => !link.url.includes('elsewhere.test')
  )
)

const tomcat = { ...host, type: 'tomcat' } as const
const tomcatHost = tomcat as AppHost
let releaseRestart!: (result: boolean) => void
let restartStarted!: () => void
const restarting = new Promise<void>((resolve) => {
  restartStarted = resolve
})
const tomcatEvents: string[] = []
const operation = new TomcatSiteSaveOperation({
  async persist() {
    tomcatEvents.push('write')
    return { host: [tomcatHost] }
  },
  applyHosts() {
    throw new Error('list unavailable')
  },
  async writeHosts() {
    throw new Error('hosts unavailable')
  },
  restart() {
    tomcatEvents.push('restart')
    return new Promise((resolve) => {
      releaseRestart = resolve
      restartStarted()
    })
  }
})
const siteWrite = operation.save({ host: tomcatHost, flag: 'edit', wasRunning: true })
await restarting
assert.equal(await operation.save({ host: tomcatHost, flag: 'edit', wasRunning: true }), false)
releaseRestart(false)
assert.equal(await siteWrite, true)
assert.deepEqual(tomcatEvents, ['write', 'restart'])
assert.deepEqual(operation.committed?.host, [tomcatHost])
assert.match(
  operation.error?.message ?? '',
  /Website list refresh.*\nHosts file sync.*\nTomcat restart/
)
assert.equal(operation.phase, 'savedWithWarning')

let attempts = 0
const uncertainTomcat = new TomcatSiteSaveOperation({
  async persist() {
    attempts++
    throw new TomcatSiteOutcomeUnknown('No terminal result')
  },
  applyHosts() {
    assert.fail('uncertain write must not refresh or restart')
  },
  async writeHosts() {
    assert.fail()
  },
  async restart() {
    assert.fail()
  }
})
assert.equal(await uncertainTomcat.save({ host: tomcatHost, flag: 'del', wasRunning: true }), false)
assert.equal(uncertainTomcat.phase, 'unknown')
assert.equal(await uncertainTomcat.save({ host: tomcatHost, flag: 'del', wasRunning: true }), false)
assert.equal(attempts, 1)

const tomcatController = new WebsiteController({
  ...dependencies,
  async list() {
    return [tomcat]
  },
  async write(snapshot, action) {
    assert.equal(snapshot.type, 'tomcat')
    assert.equal(action, 'del')
    return { hosts: [], warnings: ['Restart not confirmed'] }
  },
  reconcile() {
    assert.fail('Tomcat already reconciled its host list')
  },
  async afterCommit() {
    assert.fail('Tomcat already ran its follow-ups')
  }
})
assert.equal(await tomcatController.remove(projectFromHost(tomcat), tomcat.name), true)
assert.deepEqual(tomcatController.operation?.warnings, ['Restart not confirmed'])
assert.equal(tomcatController.projects.length, 0)

const root = await mkdtemp(join(tmpdir(), 'pqt-forge-park-'))
try {
  const dirs = ['bad name', 'blog', 'docs', 'fail', 'shop']
  await Promise.all(dirs.map((name) => mkdir(join(root, name))))
  await writeFile(join(root, 'file.txt'), 'A file is not a site')
  await mkdir(join(root, 'blog', 'nested'))
  const parent = {
    ...preserved,
    root,
    name: 'app.test',
    alias: 'www.app.test',
    isTop: true,
    useSSL: true,
    autoSSL: false,
    ssl: { cert: 'parent.crt', key: 'parent.key' }
  }
  const created: AppHost[] = []
  const cleaned: string[] = []
  const parked = await parkSubdirectories(
    parent as AppHost,
    [{ ...parent, name: 'SHOP.app.test' } as AppHost],
    async (child) => {
      if (child.name.startsWith('fail.')) throw new Error('Fixture write failed')
      created.push(child)
    },
    async (child) => {
      cleaned.push(child.name)
    }
  )
  assert.deepEqual(
    parked.added.map((child) => child.name),
    ['blog.app.test', 'docs.app.test']
  )
  assert.equal(created[0].root, join(root, 'blog'))
  assert.equal(created[0].alias, 'blog.www.app.test')
  assert.equal(created[0].useSSL, false)
  assert.equal(created[0].isTop, false)
  assert.equal(new Set(created.map((child) => child.id)).size, 2)
  assert.deepEqual(cleaned, ['fail.app.test'])
  assert.match(
    parked.warnings.join('\n'),
    /bad name.*\n.*HTTP.*\n.*HTTP.*\n.*Fixture write failed.*\n.*already in use/
  )
} finally {
  // The exact, isolated path returned by mkdtemp.
  await rm(root, { recursive: true, force: true })
}

let parkWrites = 0
const parkController = new WebsiteController({
  ...dependencies,
  async list() {
    return [preserved]
  },
  async validate() {
    assert.fail('A park action must not rewrite the parent')
  },
  async write(snapshot, action) {
    parkWrites++
    assert.equal(snapshot.id, preserved.id)
    assert.equal(action, 'park')
    return {
      hosts: [preserved],
      warnings: ['No eligible folders'],
      sync: false,
      message: 'No subdirectory websites added.'
    }
  },
  async afterCommit() {
    assert.fail('No changes to reload')
  }
})
assert.equal(await parkController.park(projectFromHost({ ...preserved, root: 'stale' })), false)
assert.equal(parkWrites, 0)
assert.equal(await parkController.park(projectFromHost(preserved)), true)
assert.equal(parkWrites, 1)
assert.equal(parkController.operation?.message, 'No subdirectory websites added.')
assert.deepEqual(parkController.operation?.warnings, ['No eligible folders'])

let finishImport!: () => void
const importFlight = parkController.runExclusive(
  () =>
    new Promise<void>((_resolve, reject) => {
      finishImport = () => reject(new WebsiteOutcomeUnknown('Import result unavailable'))
    })
)
await Promise.resolve()
assert.equal(parkController.saving, true)
assert.equal(await parkController.park(projectFromHost(preserved)), false)
finishImport()
await assert.rejects(importFlight, WebsiteOutcomeUnknown)
assert.equal(parkController.saving, false)
assert.equal(parkController.operation?.status, 'unknown')
assert.equal(await parkController.park(projectFromHost(preserved)), false)
console.log(
  'PQT Forge website lifecycle passed, including subdirectory discovery, partial success and unknown import exclusion.'
)
