import assert from 'node:assert/strict'
import { nextTick, reactive, watchEffect } from 'vue'
import { PackageController } from '../src/render-next/packages/PackageController'
import type { InstalledPackage, PackageVersion } from '../src/render-next/packages/types'
import { FORCE_DELETE_CONFIRMATION } from '../src/shared/VersionDelete'
const item = { typeFlag: 'php', version: '8.4.1', url: 'https://example.invalid/php.zip', zip: 'C:/cache/php.zip', appDir: 'C:/app/php-8.4.1', bin: 'C:/app/php-8.4.1/php.exe' }
let resolveInstall: (() => void) | undefined; let installCalls = 0; const notices: string[] = []
const deps = { ready: () => true, list: async () => ({ versions: [{ ...item }] }), installed: async () => [], install: async (_snapshot: any, progress: (value: number) => void) => { installCalls += 1; progress(12); await new Promise<void>((resolve) => { resolveInstall = resolve }) }, inspect: async () => ({ path: item.appDir, bin: item.bin, identity: 'identity' }), remove: async () => true, notice: (message: string) => notices.push(message), changed: () => undefined }
const controller = new PackageController(deps)
await controller.load('php')
const first = controller.install(item); const duplicate = controller.install(item)
assert.equal(duplicate, first); await Promise.resolve(); await Promise.resolve(); assert.equal(installCalls, 1); assert.equal(controller.operation?.progress, 12)
resolveInstall?.(); assert.equal(await first, true); assert.equal(await duplicate, true); assert.equal(controller.operation?.status, 'success'); assert.equal(notices.some((notice) => notice.includes('installed')), true)
assert.equal(await controller.remove(item, { path: item.appDir, bin: item.bin, identity: 'identity' }, 'wrong'), false)
assert.equal(await controller.remove(item, { path: item.appDir, bin: item.bin, identity: 'identity' }, FORCE_DELETE_CONFIRMATION), true)
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
const online = deferred<{ versions: PackageVersion[] }>()
const local = deferred<InstalledPackage[]>()
const reactiveController = reactive(new PackageController({
  ...deps,
  list: () => online.promise,
  installed: () => local.promise
}))
// Selecting a previously unseen package starts loading before the dialog's
// render effect reads its catalog. Completion must render without a tab click.
const initialLoad = reactiveController.load('php')
assert.equal(reactiveController.load('php'), initialLoad)
await Promise.resolve()
let rendered = ''
const stopRendering = watchEffect(() => {
  const catalog = reactiveController.catalog('php')
  rendered = JSON.stringify([catalog.loading, catalog.versions.length, catalog.installed.length])
})
assert.equal(rendered, '[true,0,0]')
online.resolve({ versions: [{ ...item }] })
await online.promise
await nextTick()
assert.equal(rendered, '[true,1,0]', 'Available must update while installed discovery is still pending, without changing tabs')
local.resolve([{ ...item, bin: item.bin, path: item.appDir, installed: true, managed: true }])
await initialLoad
await nextTick()
assert.equal(rendered, '[false,1,1]', 'Initial loading and both counts must update through the Vue proxy')
stopRendering()
let reopened = ''
const stopReopened = watchEffect(() => {
  const catalog = reactiveController.catalog('php')
  reopened = JSON.stringify([catalog.loading, catalog.versions.length, catalog.installed.length])
})
await reactiveController.load('php')
assert.equal(reopened, '[false,1,1]', 'Reopening the dialog must preserve the completed catalog')
stopReopened()
console.log('PQT Forge package controller lifecycle test passed (duplicate guard, progress, confirmation, terminal cleanup, first-load Vue rendering, independent source completion, dialog re-entry).')
