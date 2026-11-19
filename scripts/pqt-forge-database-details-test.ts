import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import mongodb from '../src/fork/module/Mongodb'
import postgresql from '../src/fork/module/Postgresql'
import redis from '../src/fork/module/Redis'
import type { SoftInstalled } from '../src/shared/app'
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
    '../adapters/databaseAdapter': {
      databaseVersion: () => selected,
      databaseModuleFlags: { MySQL: 'mysql', MariaDB: 'mariadb', MongoDB: 'mongodb' }
    },
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

selected = sql('fixture-D', '8.0.1', true)
const mongo = controller.load('MongoDB')
await tick()
assert.equal(calls.length, 6, 'a non-SQL engine only reads connection metadata')
assert.equal(calls[5].channel, 'app-fork:mongodb')
calls[5].done({ code: 0, data: { port: 27018, dataDirectory: '/fixture/D' } })
assert.equal(await mongo, true)
assert.equal(controller.connection.port, 27018)
assert.equal(controller.connection.host, '—')
assert.equal(controller.connection.user, '—')

const root = await mkdtemp(join(tmpdir(), 'pqt-forge-database-config-'))
const previousServer = global.Server
const version = (value: string) => ({ version: value }) as SoftInstalled
const path = root.replaceAll('\\', '/')
try {
  global.Server = { MongoDBDir: root, RedisDir: root, PostgreSqlDir: root } as typeof global.Server
  assert.deepEqual(await mongodb.databaseConnectionEndpoint(version('8.0.1')), {})
  await writeFile(
    join(root, 'mongodb-8.0.conf'),
    `storage:\n  dbPath: '${path}'\nnet:\n  port: 27019\n  bindIp: 127.0.0.1\n`
  )
  assert.deepEqual(await mongodb.databaseConnectionEndpoint(version('8.0.1')), {
    dataDirectory: path,
    host: '127.0.0.1',
    port: 27019
  })

  const redisConfig = join(root, 'redis-7.conf')
  await writeFile(
    redisConfig,
    `port 6380\nport 6381\ndir "${path}"\nrequirepass local-fixture-secret\n`
  )
  assert.deepEqual(await redis.databaseConnectionEndpoint(version('7.4.0')), {
    dataDirectory: path,
    host: '127.0.0.1',
    port: 6381
  })
  await writeFile(redisConfig, `port 0\ndir "${path}"\n`)
  assert.equal((await redis.databaseConnectionEndpoint(version('7.4.0'))).port, undefined)
  await writeFile(redisConfig, 'port 6381\ninclude other.conf\n')
  assert.deepEqual(await redis.databaseConnectionEndpoint(version('7.4.0')), {})

  const postgres = version('17.1.0')
  assert.deepEqual(await postgresql.databaseConnectionEndpoint(postgres, root), {
    dataDirectory: root
  })
  await writeFile(join(root, 'postgresql.conf'), "# port = 5432\nport = 5433\nport = '5434'\n")
  assert.equal((await postgresql.databaseConnectionEndpoint(postgres, root)).port, 5434)
  await writeFile(join(root, 'postgresql.auto.conf'), "port = '5435'\n")
  assert.equal((await postgresql.databaseConnectionEndpoint(postgres, root)).port, 5435)
  await writeFile(join(root, 'postgresql.conf'), "include_dir = 'conf.d'\n")
  assert.equal((await postgresql.databaseConnectionEndpoint(postgres, root)).port, undefined)
  assert.deepEqual(
    postgresql.getConfigFiles(postgres, root).map(({ path }) => path),
    [join(root, 'postgresql.conf'), join(root, 'pg_hba.conf'), join(root, 'pg_ident.conf')]
  )
} finally {
  global.Server = previousServer
  await rm(root, { recursive: true, force: true })
}

console.log(
  'Forge database details passed: binary snapshots, SQL partial failures, and saved MongoDB, Redis and PostgreSQL configuration.'
)
