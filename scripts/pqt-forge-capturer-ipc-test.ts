import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'

const replies: Array<{ target: unknown; command: string; key: string; data: any }> = []
const overlay = {}
let state = { id: '', status: 'idle' }
let opened = 0
let loaded = false
let finishLoad!: () => void
let loadFlight: Promise<any> | undefined
let visible = false
let syncFail = false
const hideTimers: Array<() => void> = []
const capturer = {
  window: overlay,
  status: () => state,
  setCallback() {},
  configUpdate() {},
  async initWatchPointWindow(id: string) { opened++; state = { id, status: 'opened' }; return state },
  stopCapturer() { if (state.id) state = { ...state, status: 'cancelled' }; return state },
  async saveImage() { throw new Error('disk fixture failed') }
}
const runtime = {
  peek: () => loaded ? capturer : undefined,
  load: () => loadFlight ??= new Promise((resolve) => { finishLoad = () => { loaded = true; resolve(capturer) } })
}
const mocks: Record<string, unknown> = {
  events: { EventEmitter },
  './lazy/OptionalRuntimes': {
    capturerRuntime: runtime,
    syncCapturerConfig: async () => { if (syncFail) throw new Error('shortcut fixture failed') }
  }
}
const bundle = await build({
  entryPoints: ['src/main/core/IPCHandler.ts'],
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'cjs',
  write: false,
  plugins: [{ name: 'capturer-ipc-native-boundaries', setup(builder) { builder.onResolve({ filter: /./ }, (args) => args.kind === 'entry-point' ? undefined : { path: args.path, external: true }) } }]
})
const module = { exports: {} as any }
runInNewContext(bundle.outputFiles[0].text, {
  module,
  exports: module.exports,
  Error,
  global: { Server: {} },
  process,
  console,
  setTimeout: (callback: () => void) => { hideTimers.push(callback); return hideTimers.length },
  require: (name: string) => mocks[name] ?? {}
})
const mainWindow = { isVisible: () => visible, hide: () => { visible = false }, setOpacity() {} }
const handler = new module.exports.default({ mainWindow, windowManager: { sendCommandTo: (target: unknown, command: string, key: string, data: any) => replies.push({ target, command, key, data }) } })
const tick = async () => { await new Promise((resolve) => setImmediate(resolve)) }
handler.handleCommand('Capturer:doCapturer', 'start-load', false, 'load-id')
handler.handleCommand('Capturer:doCapturer', 'duplicate-load', false, 'duplicate-id')
assert.equal(replies.find((reply) => reply.key === 'duplicate-load')?.data.code, 1)
handler.handleCommand('Capturer:doStopCapturer', 'stop-load')
assert.equal(replies.some((reply) => reply.key === 'stop-load'), false, 'Stop waits for the queued native load')
finishLoad()
await tick()
assert.equal(opened, 0, 'A cancelled lazy start must never open the overlay')
assert.equal(replies.find((reply) => reply.key === 'start-load')?.data.code, 1)
assert.equal(replies.find((reply) => reply.key === 'stop-load')?.data.data.status, 'idle')

visible = true
handler.handleCommand('Capturer:doCapturer', 'start-hide', true, 'hide-id')
await tick()
assert.equal(hideTimers.length, 1)
handler.handleCommand('Capturer:doStopCapturer', 'stop-hide')
await tick()
hideTimers.shift()!()
await tick()
assert.equal(opened, 0, 'A cancelled hide-delay start must never open the overlay')

handler.handleCommand('Capturer:doCapturer', 'start-valid', false, 'valid-id')
await tick()
assert.equal(opened, 1)
assert.equal(replies.find((reply) => reply.key === 'start-valid')?.data.data.status, 'opened')
handler.handleCommand('Capturer:saveImage', 'save-failure', 'png', true)
await tick()
const saveReplies = replies.filter((reply) => reply.key === 'save-failure')
assert.equal(saveReplies.length, 2, 'Save errors must reach both main and overlay request owners')
assert.ok(saveReplies.every((reply) => reply.data.code === 1 && reply.data.msg === 'disk fixture failed'))
assert.ok(saveReplies.some((reply) => reply.target === overlay))

const oldConfig = { name: 'old', dir: '', key: [] }
handler.handleCommand('Capturer:Config-Update', 'config-old', oldConfig)
await tick()
syncFail = true
handler.handleCommand('Capturer:Config-Update', 'config-failed', { ...oldConfig, key: ['Control', 'Q'] })
await tick()
assert.equal(handler.capturerConfig, oldConfig, 'Rejected config must not poison future lazy loads')
assert.equal(replies.find((reply) => reply.key === 'config-failed')?.data.code, 1)
console.log('Capturer IPC passed: lazy-load/hide cancellation, native re-entry, save failure routing and rejected-config rollback.')
