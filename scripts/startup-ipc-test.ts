// Run: yarn tsx scripts/startup-ipc-test.ts
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import { ForkPromise } from '../src/shared/ForkPromise'

const replies: any[][] = []
const requests: { args: any[]; promise: ForkPromise<any>; progress: (info: any) => void }[] = []
const server = { DebugForkActions: [] }
const bootstrap = { locale: 'vi', revision: 1, messages: {} }
class ForkManager {
  setLanguageSnapshotProvider() {}
  on() {}
  send(...args: any[]) {
    let progress!: (info: any) => void
    const promise = new ForkPromise<any>((_resolve, _reject, on) => {
      progress = on
    })
    requests.push({ args, promise, progress })
    return promise
  }
}
const mocks: Record<string, any> = {
  events: { EventEmitter },
  os: { cpus: () => [{}] },
  '@shared/PerformanceDiagnostics': {
    performanceDiagnosticNow: () => 0,
    performanceDiagnosticElapsed: () => 0
  },
  '@shared/OperationTiming': { timeOperationSync: (_name: string, run: () => any) => run() },
  '@shared/WindowsPathDiagnostics': {
    isWindowsPathCommand: () => false,
    logWindowsPath() {}
  },
  '@shared/WindowsPrivilege': {
    withWindowsPrivilegeInteraction: (_interactive: boolean, run: () => any) => run()
  },
  './ServiceLifecycle': {
    serviceLifecycleAction: () => undefined,
    hasServiceLifecyclePermit: () => false,
    captureServiceLifecycleValidity: () => () => true,
    isServiceLifecycleContextExpired: () => false
  },
  './ServiceProcess': { statusOf: () => ({ revision: 1 }), onStatusChange() {} },
  './core/ServiceVersionManager': { onMcpNotify() {} },
  './core/ForkManager': { ForkManager },
  './core/WindowsPrivilegeBridge': { WindowsPrivilegeBridge: class {} },
  './utils/AppRuntimePath': { getElectronResourcePath: (file: string) => file }
}
mocks['@shared/ForkPromise'] = { ForkPromise }
mocks['./core/ServiceProcess'] = mocks['./ServiceProcess']
// Mock native boundaries for startup routing; verify full windows in Electron.
async function load(file: string) {
  const bundle = await build({
    entryPoints: [file],
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'cjs',
    write: false,
    plugins: [
      {
        name: 'startup-boundaries',
        setup(builder) {
          builder.onResolve({ filter: /./ }, (args) =>
            args.kind === 'entry-point' ? undefined : { path: args.path, external: true }
          )
        }
      }
    ]
  })
  const module = { exports: {} as any }
  runInNewContext(bundle.outputFiles[0].text, {
    module,
    exports: module.exports,
    global: { Server: server },
    process,
    console,
    require: (name: string) => mocks[name] ?? {}
  })
  return module.exports
}
const { default: IPCHandler } = await load('src/main/core/IPCHandler.ts')
const { default: Application } = await load('src/main/Application.ts')
const handler = new IPCHandler({
  mainWindow: {},
  windowManager: { sendCommandTo: (...args: any[]) => replies.push(args.slice(1)) },
  serverManager: { setProxy() {}, updateGlobalConfig() {} },
  languageCoordinator: { bootstrap: () => bootstrap }
})
handler.handleCommand('application:language-bootstrap', 'language-1')
assert.equal(replies[0][0], 'application:language-bootstrap')
assert.equal(replies[0][1], 'language-1')
assert.equal(replies[0][2].data, bootstrap)
handler.handleCommand('app-fork:app', 'missing-fork', 'getConfig')
assert.equal(replies.at(-1)?.[2].code, 1)
assert.equal(replies.at(-1)?.[2].msg, 'Fork manager not initialized')

const application = Object.assign(Object.create(Application.prototype), {
  ipcHandler: handler,
  languageCoordinator: { snapshot: () => bootstrap }
})
application.initForkManager()
handler.handleCommand('app-fork:app', 'config-1', 'getConfig')
assert.deepEqual(requests[0].args, ['app', 'getConfig'])
requests[0].progress({ code: 200, msg: 'loading' })
assert.equal(replies.at(-1)?.[2].code, 200)
assert.equal(server.DebugForkActions.length, 1)
requests[0].promise.resolve({ code: 0, data: { setup: {} } })
await new Promise((resolve) => setImmediate(resolve))
assert.equal(replies.at(-1)?.[1], 'config-1')
assert.equal(replies.at(-1)?.[2].code, 0)
assert.equal(server.DebugForkActions.length, 0)

handler.handleCommand('app-fork:app', 'config-2', 'getConfig')
requests[1].promise.reject(new Error('config failed'))
await new Promise((resolve) => setImmediate(resolve))
assert.equal(replies.at(-1)?.[1], 'config-2')
assert.equal(replies.at(-1)?.[2].code, 1)
assert.equal(replies.at(-1)?.[2].msg, 'Error: config failed')
assert.equal(server.DebugForkActions.length, 0)

const { ForkManager: WorkerManager } = await load('src/main/core/ForkManager.ts')
const manager = Object.assign(Object.create(WorkerManager.prototype), {
  forks: [
    {
      activeTaskCount: 0,
      isPrimary: true,
      send: (...args: any[]) => args,
      sendLanguage: async () => {},
      child: { postMessage() {} }
    }
  ],
  serviceLifecycleRequests: new Set(),
  rawLifecycleRequests: new Set()
})
assert.deepEqual(manager.send('app', 'getConfig'), ['app', 'getConfig'])
await manager.broadcastLanguage({})
manager.broadcastServer({})
manager.beginServiceLifecycleShutdown()
await assert.rejects(Promise.resolve(manager.send('app', 'getConfig')), /shutting down/)
console.log('Startup IPC routing passed')
