import assert from 'node:assert/strict'
import { loadIsolated } from './helpers/load-isolated'

type FixtureVersion = { bin: string; version: string; run: boolean; rootPassword?: string }
type Reply = { code: number; data?: unknown; msg?: string }
const sql = (bin: string, version: string, run: boolean): FixtureVersion => ({ bin, version, run })
let selected = sql('fixture-A', '8.4.3', true)
const calls: Array<{ channel: string; args: any[]; done: (response: Reply) => void }> = []
const notices: string[] = []
const { databaseToolsController: controller } = await loadIsolated(
  'src/render-next/state/databaseToolsController.ts',
  {
    '@/util/Index': { reactiveBind: (value: unknown) => value },
    '@/util/NodeFn': { shell: {} },
    '@/components/Mysql/Manage/manage': {
      MySQLManage: {
        ready: async () => undefined,
        userPassword: { 'fixture-A': { root: 'saved-fixture-credential' } }
      }
    },
    '@/util/ForkTerminalRequest': {
      forkTerminalRequest: (channel: string, args: any[]) =>
        new Promise<Reply>((done) => calls.push({ channel, args, done }))
    },
    '../adapters/databaseAdapter': { databaseVersion: () => selected },
    './app': { showNotice: (text: string) => notices.push(text) }
  }
)
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

const first = controller.load('MySQL')
assert.equal(controller.load('MySQL'), first)
await tick()
assert.equal(calls.length, 2)
assert.deepEqual(
  Array.from(calls[0].args, (argument) => (typeof argument === 'string' ? argument : argument.bin)),
  ['databaseConnectionEndpoint', 'fixture-A']
)
assert.equal(calls[1].args[0], 'getDatabasesWithUsers')
assert.equal(calls[1].args[1].rootPassword, 'saved-fixture-credential')

selected = sql('fixture-B', '9.6.0', false)
const second = controller.load('MySQL')
await tick()
assert.equal(calls.length, 3, 'a stopped database only reads its configured endpoint')
calls[2].done({ code: 0, data: { port: 33063, dataDirectory: '/fixture/B' } })
assert.equal(await second, true)
calls[0].done({ code: 1, msg: 'stale endpoint failure' })
calls[1].done({ code: 0, data: { list: [{ name: 'stale_account_data' }] } })
assert.equal(await first, false)
assert.equal(controller.connection.bin, 'fixture-B')
assert.equal(controller.connection.port, 33063)
assert.equal(controller.connection.dataDirectory, '/fixture/B')
assert.equal(controller.databases.length, 0)
assert.deepEqual(notices, [])

selected = sql('fixture-C', '10.11.11', true)
const partial = controller.load('MariaDB')
await tick()
assert.equal(calls[3].channel, 'app-fork:mariadb')
calls[3].done({ code: 0, data: { port: 33064, dataDirectory: '/fixture/C' } })
calls[4].done({ code: 1, msg: 'Could not query accounts' })
assert.equal(await partial, false)
assert.equal(controller.connection.port, 33064)
assert.equal(controller.connection.dataDirectory, '/fixture/C')
assert.equal(controller.loading, false)
assert.equal(controller.error, 'Could not query accounts')
assert.deepEqual(notices, ['Could not query accounts'])

console.log(
  'Forge database details passed: binary snapshots, hydration, stopped configuration, stale replies, partial failures.'
)
