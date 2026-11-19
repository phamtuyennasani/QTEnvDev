import assert from 'node:assert/strict'
import { ToolOperation } from '../src/render-next/tools/ToolOperation'
const schedule = globalThis.setTimeout
const unschedule = globalThis.clearTimeout
let observedTimeout: (() => void) | undefined
let scheduled = 0
globalThis.setTimeout = ((callback: () => void) => { observedTimeout = callback; scheduled++; return 1 }) as unknown as typeof setTimeout
globalThis.clearTimeout = (() => undefined) as unknown as typeof clearTimeout
const callbacks = new Map<string, (key: string, reply: any) => void>()
const calls: unknown[][] = []; const removed: string[] = []
const controller = new ToolOperation({
  send(command, ...args) { calls.push([command, ...args]); const key = 'key-' + calls.length; return { key, then(callback) { callbacks.set(key, callback) } } },
  off(key) { removed.push(key); callbacks.delete(key) }
})
const source = { domains: 'localhost', savePath: 'C:/out' }
let output = ''
const first = controller.run('app-fork:tools', ['sslMake', source], (data) => { output = data })
const duplicate = controller.run('app-fork:tools', ['sslMake', source], () => { throw Error('Duplicate callback must not run') })
assert.equal(first, duplicate)
source.savePath = 'C:/changed'
assert.equal((calls[0][2] as any).savePath, 'C:/out')
callbacks.get('key-1')!('key-1', { code: 200, msg: { finish: 3 } })
assert.equal(controller.running, true)
assert.equal(controller.progress.finish, 3)
callbacks.get('key-1')!('key-1', { code: 0, data: 'completed' })
assert.equal(await first, true)
assert.equal(output, 'completed')
assert.equal(controller.running, false)
assert.equal(controller.done, true)
assert.deepEqual(removed, ['key-1'])
const retry = controller.run('app-fork:tools', ['sslMake', source], () => undefined)
const replyAgain = callbacks.get('key-2')!
callbacks.get('key-2')!('key-2', { code: 1, msg: 'Cannot write' })
replyAgain('key-2', { code: 0, data: 'late duplicate' })
assert.equal(await retry, false)
assert.equal(controller.error, 'Cannot write')
assert.equal(controller.done, false)
assert.equal(await controller.runLocal(() => { throw new Error('Synchronous local error') }), false)
assert.match(controller.error, /Synchronous local error/)
let synchronousCalls = 0
const synchronous = new ToolOperation({ send() { return { key: 'sync', then(callback) { callback('sync', { code: 0 }); callback('sync', { code: 0 }) } } }, off() {} })
assert.equal(await synchronous.run('request', [], () => { synchronousCalls++ }), true)
assert.equal(synchronousCalls, 1, 'duplicate terminal callbacks are ignored')
let retained: ((key: string, reply: any) => void) | undefined
const throwingProgress = new ToolOperation({ send() { return { key: 'progress', then(callback) { retained = callback } } }, off() {} })
const withProgress = throwingProgress.run('request', [], () => undefined, () => { throw new Error('Display failed') })
retained!('progress', { code: 200, msg: { finish: 1 } })
assert.equal(throwingProgress.running, true)
assert.match(throwingProgress.warning, /Display failed/)
retained!('progress', { code: 0 })
assert.equal(await withProgress, true)
const beforeSynchronous = scheduled
await synchronous.run('request', [], () => undefined)
assert.equal(scheduled, beforeSynchronous, 'a synchronous terminal callback cannot leave a watchdog timer')
const lateResult = throwingProgress.run('request', [], () => undefined)
observedTimeout!()
assert.equal(throwingProgress.unknown, true)
assert.equal(throwingProgress.run('request', [], () => undefined), lateResult, 'unknown request remains guarded')
retained!('progress', { code: 0 })
assert.equal(await lateResult, true)
assert.equal(throwingProgress.unknown, false)
globalThis.setTimeout = schedule
globalThis.clearTimeout = unschedule
console.log('PQT Forge operation adapters passed: duplicate guard, snapshot, progress retention, success/failure cleanup and retry.')
