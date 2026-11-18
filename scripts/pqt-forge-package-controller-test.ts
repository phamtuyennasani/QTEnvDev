import assert from 'node:assert/strict'
import { PackageController } from '../src/render-next/packages/PackageController'
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
console.log('PQT Forge package controller lifecycle test passed (duplicate guard, progress, confirmation, terminal cleanup).')
