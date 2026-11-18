import assert from 'node:assert/strict'
import { reactive } from 'vue'
import { WebsiteController } from '../src/render-next/websites/WebsiteController'
import { newWebsite, normalizeWebsite, projectFromHost, websiteUrl } from '../src/render-next/websites/model'
import { WebsiteOutcomeUnknown, type WebsiteDependencies, type WebsiteHost } from '../src/render-next/websites/types'

const host = Object.assign(newWebsite(), { name: 'app.test', root: 'C:/Projects/app', projectName: 'Application', reverseProxy: [{ path: '/api', url: 'http://127.0.0.1:3000' }] })
let listed: WebsiteHost[] = [host]
let lists = 0; let writes = 0; let fail = false; let unknown = false
let finish: ((hosts: WebsiteHost[]) => void) | undefined
let observedName = ''
const dependencies: WebsiteDependencies = {
  ready: () => true,
  async list() { lists++; return listed },
  async validate() {},
  async write(snapshot, _action, _old, progress) {
    writes++; observedName = snapshot.name
    progress('Issuing local certificate…')
    if (unknown) throw new WebsiteOutcomeUnknown('Unknown result')
    if (fail) throw new Error('Write failed')
    return new Promise((resolve) => { finish = resolve })
  },
  reconcile() {},
  async afterCommit() { throw new Error('Restart failed') },
  async open() {}, async choosePath() { return undefined }, async reveal() {}, logFiles() { return [] }, vhostFiles() { return [] }, notice() {}
}
const controller = reactive(new WebsiteController(dependencies))
const refresh = controller.refresh()
assert.equal(refresh, controller.refresh())
assert.equal(await refresh, true); assert.equal(lists, 1); assert.equal(controller.projects[0].domain, 'app.test')
listed = []; assert.equal(await controller.refresh(), true); assert.equal(controller.projects.length, 0)
const pending = controller.save(host)
assert.equal(await controller.save(host), false)
await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
assert.equal(writes, 1); assert.equal(controller.operation?.status, 'running'); assert.equal(controller.operation?.message, 'Issuing local certificate…')
host.name = 'mutated.test'
assert.equal(observedName, 'app.test')
listed = [{ ...host, name: 'app.test' }]
finish?.(listed)
assert.equal(await pending, true)
assert.equal(controller.saving, false); assert.equal(controller.operation?.status, 'success')
assert.match(controller.operation?.warnings[0] || '', /Restart failed/)
assert.equal(controller.projects[0].domain, 'app.test')
fail = true
assert.equal(await controller.save(host), false); assert.equal(controller.operation?.status, 'failed'); assert.equal(controller.saving, false)
fail = false
listed = []
const retry = controller.save(host); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); listed = [host]; finish?.(listed); assert.equal(await retry, true)
const project = projectFromHost(host); const beforeRemoval = writes
assert.equal(await controller.remove(project, 'wrong'), false); assert.equal(writes, beforeRemoval)
const removal = controller.remove(project, project.domain); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); finish?.([]); assert.equal(await removal, true); assert.equal(controller.projects.length, 0)
listed = []
unknown = true
assert.equal(await controller.save(host), false); assert.equal(controller.operation?.status, 'unknown')
const beforeReplay = writes
assert.equal(await controller.save(host), false); assert.equal(writes, beforeReplay)
await controller.refresh()
assert.equal(await controller.save(host), false); assert.equal(writes, beforeReplay)
assert.throws(() => normalizeWebsite({ ...host, name: 'app.test/path' }))
assert.throws(() => normalizeWebsite({ ...host, name: 'app.test:8080' }))
assert.throws(() => normalizeWebsite({ ...host, name: 'app.test', useSSL: true, autoSSL: false }))
const preserved = normalizeWebsite({ ...host, name: 'APP.test', alias: 'www.app.test\nwww.app.test', nginx: { rewrite: 'existing rewrite' }, port: { ...host.port, nginx: 8088 } })
assert.equal(preserved.name, 'app.test'); assert.equal(preserved.alias, 'www.app.test'); assert.equal(preserved.nginx.rewrite, 'existing rewrite')
assert.equal(websiteUrl(preserved), 'http://app.test:8088/')
assert.equal(websiteUrl({ ...preserved, useSSL: true, port: { ...preserved.port, nginx_ssl: 8443 } }), 'https://app.test:8443/')
console.log('PQT Forge website lifecycle passed: empty refresh, duplicate, progress, retry, committed write warnings, unknown replay lock, confirmation and field preservation.')
