import assert from 'node:assert/strict'
import { RequestTimingOperation } from '../src/render-next/tools/RequestTimingOperation'
import { MysqlCodeOperation } from '../src/render-next/tools/MysqlCodeOperation'
import { RsaOperation } from '../src/render-next/tools/RsaOperation'
import type { ToolTransport } from '../src/render-next/tools/ToolOperation'
const schedule = globalThis.setTimeout; const unschedule = globalThis.clearTimeout
let timeout: (() => void) | undefined
globalThis.setTimeout = ((callback: () => void) => { timeout = callback; return 1 }) as unknown as typeof setTimeout
globalThis.clearTimeout = (() => undefined) as unknown as typeof clearTimeout
const callbacks: ((key: string, reply: any) => void)[] = []; const calls: unknown[][] = []; const off: string[] = []
const transport: ToolTransport = { send(command, ...args) { const key = String(calls.length); calls.push([command, ...args]); return { key, then(callback) { callbacks.push(callback) } } }, off(key) { off.push(key) } }
const timing = new RequestTimingOperation(transport)
timing.url = 'file:///secret'
assert.equal(timing.fetch(), false)
timing.url = 'https://example.test'
const measured = timing.fetch()
assert.equal(timing.fetch(), measured)
timeout!()
assert.equal(timing.operation.unknown, true)
assert.equal(timing.fetch(), measured)
callbacks[0]('0', { code: 200, msg: 'progress' })
assert.equal(timing.loading, true)
callbacks[0]('0', { code: 0, data: [{ Metric: 'Total', Value: 10 }] })
assert.equal(await measured, true)
assert.equal(timing.operation.unknown, false)
assert.equal(timing.list[0].Value, 10)
timing.url = 'https://failed.test'
const failed = timing.fetch()
callbacks[1]('1', { code: 1, msg: 'Network failed' })
assert.equal(await failed, false)
assert.equal(timing.list[0].Value, 10, 'prior metrics survive failure')
const mysql = new MysqlCodeOperation(transport)
assert.equal(mysql.connect({ user: 'root', password: '', host: 'localhost', port: Infinity }), false)
const credentials = { user: 'root', password: 'private', host: 'localhost', port: 3306 }
const connected = mysql.connect(credentials)
credentials.host = 'changed'
assert.equal((calls[2][2] as any).host, 'localhost')
assert.equal(mysql.connect(credentials), connected)
callbacks[2]('2', { code: 0, data: ['db'] })
assert.equal(await connected, true)
assert.deepEqual(mysql.databases, ['db'])
let complete!: (value: { publicKey: string; privateKey: string }) => void
let generated = 0
const rsa = new RsaOperation(async () => { generated++; return new Promise((resolve) => { complete = resolve }) })
assert.equal(rsa.generate(NaN), false)
assert.equal(rsa.generate(2049), false)
const generation = rsa.generate(2048)
assert.equal(rsa.generate(2048), generation)
await Promise.resolve()
assert.equal(generated, 1)
timeout!()
assert.equal(rsa.operation.unknown, true)
complete({ publicKey: 'public', privateKey: 'private' })
assert.equal(await generation, true)
assert.equal(rsa.operation.unknown, false)
assert.equal(rsa.publicKey, 'public')
assert.equal(rsa.privateKey, 'private')
assert.deepEqual(off, ['0', '1', '2'])
globalThis.setTimeout = schedule; globalThis.clearTimeout = unschedule
console.log('Remaining toolbox operations passed: validated timing/MySQL/RSA snapshots, duplicate guard, progress, unknown late terminal, retained results and cleanup.')
