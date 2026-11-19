import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import httpServe, { verifyHttpServeFolder } from '../src/main/core/HttpServer'

const bundle = await build({
  entryPoints: ['src/main/core/IPCHandler.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  plugins: [
    {
      name: 'http-serve-ipc',
      setup(builder) {
        builder.onResolve({ filter: /./ }, (args) =>
          args.kind === 'entry-point' ? undefined : { path: args.path, external: true }
        )
      }
    }
  ]
})
const mainModule = { exports: {} as any }
let failStart = false
let failStop = false
const runtime = {
  snapshot: () => httpServe.snapshot(),
  verifyFolder: verifyHttpServeFolder,
  start: async (path: string) => {
    if (failStart) throw new Error('Port unavailable')
    return httpServe.start(path)
  },
  stop: async (path: string) => {
    if (failStop) throw new Error('Stop failed')
    return httpServe.stop(path)
  },
  stopAll: () => httpServe.stopAll()
}
const imports: Record<string, unknown> = {
  events: { EventEmitter },
  './lazy/OptionalRuntimes': {
    httpServerRuntime: { load: async () => runtime, peek: () => runtime }
  }
}
runInNewContext(bundle.outputFiles[0].text, {
  module: mainModule,
  exports: mainModule.exports,
  Error,
  process,
  require: (name: string) => imports[name] ?? {}
})

const folder = await mkdtemp(join(tmpdir(), 'pqt-http-serve-'))
try {
  const file = join(folder, 'index.html')
  await writeFile(file, 'Fixture served by HTTP Serve')
  await assert.rejects(httpServe.start(file))
  const first = httpServe.start(folder)
  const duplicate = httpServe.start(folder)
  const status = httpServe.snapshot()
  const server = await first
  assert.deepEqual(await duplicate, server)
  assert.deepEqual(await status, [server])
  const url = new URL(server.host[0])
  url.hostname = '127.0.0.1'
  assert.equal(await (await fetch(url)).text(), 'Fixture served by HTTP Serve')
  assert.equal(await httpServe.stop(folder), folder)
  assert.deepEqual(await httpServe.snapshot(), [])
  await assert.rejects(fetch(url))
  const restarted = httpServe.start(folder)
  const cleanup = httpServe.stopAll()
  await restarted
  await cleanup
  assert.deepEqual(await httpServe.snapshot(), [])

  let saved = [folder]
  const replies = new Map<string, (reply: any) => void>()
  const ipc = new mainModule.exports.default({
    mainWindow: {},
    windowManager: {
      sendCommandTo(_target: unknown, _channel: string, key: string, response: any) {
        replies.get(key)?.(response)
        replies.delete(key)
      }
    },
    configManager: {
      getConfig(key: string) {
        assert.equal(key, 'httpServe')
        return saved
      },
      setConfig(key: string, folders: string[]) {
        assert.equal(key, 'httpServe')
        saved = folders
      }
    }
  })
  let seq = 0
  function send(action: string, path?: string): Promise<any> {
    return new Promise((resolve) => {
      const key = String(++seq)
      replies.set(key, resolve)
      ipc.handleCommand('app-http-serve-manage', key, action, path)
    })
  }
  assert.deepEqual(
    (await send('list')).data.folders,
    [folder],
    'legacy saved folder remains available'
  )
  assert.equal((await send('start', folder)).code, 0)
  failStop = true
  assert.equal((await send('remove', folder)).code, 1)
  assert.deepEqual(
    (await send('list')).data.folders,
    [folder],
    'failed stop preserves saved folder'
  )
  assert.equal((await send('list')).data.active.length, 1)
  failStop = false
  assert.equal((await send('remove', folder)).code, 0)
  assert.equal((await send('list')).data.active.length, 0)
  assert.equal((await send('list')).data.folders.length, 0)
  assert.equal((await send('add', file)).code, 1)
  failStart = true
  const result = await send('add', folder)
  assert.equal(result.code, 0, result.msg)
  assert.match(result.data.warning, /Folder saved/)
  assert.deepEqual(Array.from((await send('list')).data.folders), [folder])
  failStart = false
  const starting = send('start', folder)
  const stopped = ipc.stopHttpServe()
  assert.equal((await starting).code, 0)
  await stopped
  assert.equal((await send('list')).data.active.length, 0)
} finally {
  await httpServe.stopAll()
  await rm(folder, { recursive: true, force: true })
}
console.log(
  'HTTP Serve passed: native response, concurrent start, shutdown, legacy preferences and partial IPC failures.'
)
