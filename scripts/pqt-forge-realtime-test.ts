import assert from 'node:assert/strict'

const sent: { command: string; key: string; args: any[] }[] = []
const log = console.log
console.log = () => {}
let receive: (event: unknown, command: string, key: string, ...args: any[]) => void
Object.assign(globalThis, { window: { QTEnvDevNodeAPI: { ipcReceiveFromMain(callback: typeof receive) { receive = callback }, ipcSendToMain(command: string, key: string, ...args: any[]) { sent.push({ command, key, args }) } } } })
class FakeSocket {
  static OPEN = 1
  static instances: FakeSocket[] = []
  readyState = 0
  onopen: null | (() => void) = null
  onmessage: null | ((event: { data: string }) => void) = null
  onerror: null | (() => void) = null
  onclose: null | ((event: { code: number; reason: string }) => void) = null
  messages: string[] = []
  closed = false
  constructor(public url: string, public protocols: string[]) { FakeSocket.instances.push(this) }
  send(value: string) { this.messages.push(value) }
  close() { this.closed = true }
}
Object.assign(globalThis, { WebSocket: FakeSocket })
const { default: store } = await import('../src/render/components/Tools/WebSocketSSE/store')
const { default: IPC } = await import('../src/render/util/IPC')
store.url = 'ws://localhost:3000/ws'
store.params = [{ id: 1, key: 'query', value: 'Việt', enabled: true }]
store.protocols = 'chat, graphql-transport-ws'
store.connect()
const first = FakeSocket.instances[0]
const staleOpen = first.onopen!, staleClose = first.onclose!, staleMessage = first.onmessage!
assert.match(first.url, /query=Vi%E1%BB%87t/)
assert.deepEqual(first.protocols, ['chat', 'graphql-transport-ws'])
assert.equal(store.connect(), false)
assert.equal(FakeSocket.instances.length, 1)
first.readyState = FakeSocket.OPEN; first.onopen!()
assert.equal(store.status, 'Connected')
store.message = '{"ping": true}'
store.sendMessage()
assert.deepEqual(first.messages, ['{"ping":true}'])
store.disconnect()
assert(first.closed)
assert.equal(first.onopen, null)
store.connect()
const second = FakeSocket.instances[1]
assert.equal(store.status, 'Connecting')
staleOpen(); staleClose({ code: 1000, reason: 'old' }); staleMessage({ data: 'stale data' })
assert.equal(store.status, 'Connecting')
assert(!store.logs.some(log => log.content === 'stale data'))
second.readyState = FakeSocket.OPEN; second.onopen!()
assert.equal(store.status, 'Connected')
store.disconnect()

store.protocol = 'sse'
store.url = 'https://example.com/events'
store.params = []
store.headers = [{ id: 1, key: 'X-Test', value: 'present', enabled: true }]
store.sseLastEventId = 'last-7'
store.connect()
const stream = sent.findLast(request => request.args[1] === 'sseConnect')!
assert.equal(stream.args[2].headers['X-Test'], 'present')
assert.equal(stream.args[2].headers['Last-Event-ID'], 'last-7')
receive!({}, stream.command, stream.key, { code: 100, status: 200 })
assert.equal(store.status, 'Connected')
store.sseEventFilter = 'update'
receive!({}, stream.command, stream.key, { code: 200, data: 'event: update\nid: 5\ndata: {"ok":' })
receive!({}, stream.command, stream.key, { code: 200, data: 'true}\n\nevent: ignored\ndata: no\n\n' })
assert(store.logs.some(log => log.label === 'event: update, id: 5' && log.content.includes('"ok": true')))
assert(!store.logs.some(log => log.label === 'event: ignored'))
store.disconnect()
store.connect()
const newer = sent.findLast(request => request.args[1] === 'sseConnect')!
receive!({}, stream.command, stream.key, { code: 500, error: 'stale error' })
assert.equal(store.status, 'Connecting')
assert.equal(IPC.listens[stream.key], undefined)
receive!({}, newer.command, newer.key, { code: 100, status: 200 })
receive!({}, newer.command, newer.key, { code: 200, data: 'x'.repeat(1024 * 1024 + 1) })
assert.equal(store.status, 'Error')
assert.match(store.error, /1 MB/)
receive!({}, newer.command, newer.key, { code: 0 })
assert.equal(IPC.listens[newer.key], undefined)
store.disconnect()
store.clearLogs()
for (let index = 0; index < 400; index++) store.addLog('info', String(index))
assert.equal(store.logs.length, 300)
console.log = log
console.log('PQT Forge realtime passed: duplicate guard, stale WS/SSE callbacks, protocol/query/header snapshots, JSON send, chunked filtered events, buffer/log limits and terminal listener cleanup.')
