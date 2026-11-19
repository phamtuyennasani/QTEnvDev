import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import mongodb from '../src/fork/module/Mongodb'
import postgresql from '../src/fork/module/Postgresql'
import qdrant from '../src/fork/module/Qdrant'
import redis from '../src/fork/module/Redis'
import type { SoftInstalled } from '../src/shared/app'
import {
  readSqlField,
  sqlCommonFields,
  updateSqlField,
  visibleSqlFields
} from '../src/render-next/mysql/commonConfig'
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

  const configDirectory = join(root, 'config')
  const qdrantVersion = { bin: join(root, 'qdrant') } as SoftInstalled
  await mkdir(configDirectory)
  await writeFile(join(configDirectory, 'config.yaml'), 'service: {http_port: 6333}')
  assert.deepEqual(await qdrant.listConfigFiles(qdrantVersion), [
    {
      name: 'config.yaml',
      path: join(configDirectory, 'config.yaml'),
      defaultPath: undefined,
      exists: true
    }
  ])
  await writeFile(join(configDirectory, 'config.default.yaml'), 'service: {http_port: 6333}')
  assert.deepEqual(await qdrant.listConfigFiles(qdrantVersion), [
    {
      name: 'config.yaml',
      path: join(configDirectory, 'config.yaml'),
      defaultPath: join(configDirectory, 'config.default.yaml'),
      exists: true
    }
  ])
} finally {
  global.Server = previousServer
  await rm(root, { recursive: true, force: true })
}

const qdrantStatus = { name: 'Qdrant', state: 'stopped' }
const dashboardRequests: typeof calls = []
const dashboardNotices: string[] = []
const { databaseAdminController: admin } = await loadIsolated(
  'src/render-next/state/databaseAdminController.ts',
  {
    './app': { showNotice: (text: string) => dashboardNotices.push(text) },
    '@/components/PostgreSql/PgAdminPanel': {},
    '@/components/Redis/RedisCommanderPanel': {},
    '@/components/MongoDB/DbGatePanel': {},
    '@/components/ClickHouse/ChUiPanel': {},
    '@/components/Neo4j/controller': {},
    '@/store/app': {},
    '@/store/brew': {},
    './databaseController': { databaseController: { databases: [qdrantStatus] } },
    '@/util/ForkTerminalRequest': {
      forkTerminalRequest: (channel: string, args: any[]) =>
        new Promise<Reply>((done) => dashboardRequests.push({ channel, args, done }))
    }
  }
)
assert.equal(await admin.open('qdrant-dashboard'), false)
assert.equal(dashboardRequests.length, 0)
qdrantStatus.state = 'running'
const dashboard = admin.open('qdrant-dashboard')
assert.equal(await admin.open('qdrant-dashboard'), false)
assert.equal(admin.isOpening('qdrant-dashboard'), true)
assert.equal(dashboardRequests.length, 1)
assert.equal(dashboardRequests[0].channel, 'App-Node-FN')
assert.deepEqual(Array.from(dashboardRequests[0].args), [
  'shell',
  'openExternalChecked',
  'http://127.0.0.1:6333/dashboard'
])
dashboardRequests[0].done({ code: 1, msg: 'The browser did not open.' })
assert.equal(await dashboard, false)
assert.deepEqual(dashboardNotices, ['The browser did not open.'])
assert.equal(admin.isOpening('qdrant-dashboard'), false)
const retryDashboard = admin.open('qdrant-dashboard')
dashboardRequests[1].done({ code: 0 })
assert.equal(await retryDashboard, true)

const port = sqlCommonFields[0]
const originalIni =
  '# Fixture\r\n[client]\r\nport = 3306\r\n[mysqld]\r\n  port = 3307 # earlier\r\n[mariadbd]\r\nport = 3308  # local port\r\n'
assert.equal(readSqlField(originalIni, 'mariadb', port).value, '3308')
const updatedIni = updateSqlField(originalIni, 'mariadb', port, true, '3311')
assert.equal(updatedIni, originalIni.replace('3308', '3311'))
const disabledIni = updateSqlField(updatedIni, 'mariadb', port, false, '')
assert.equal(readSqlField(disabledIni, 'mariadb', port).enabled, false)
assert.match(disabledIni, /\[client\]\r\nport = 3306/)
assert.match(disabledIni, /# port = 3311  # local port/)
assert.equal(updateSqlField('[mysqld]\n', 'mysql', port, true, '3312'), '[mysqld]\nport = 3312\n')
assert.equal(updateSqlField('[mariadbd]', 'mariadb', port, true, '3312'), '[mariadbd]\nport = 3312')
assert.equal(updateSqlField(originalIni, 'mysql', port, true, '3312\nfoo = bar'), originalIni)
assert.ok(
  visibleSqlFields('mysql', '5.7.0', false).some((field) => field.name === 'query_cache_size')
)
assert.ok(
  !visibleSqlFields('mysql', '8.0.0', true).some(
    (field) => field.name === 'query_cache_size' || field.name === 'socket'
  )
)

let installed = false
let complete!: () => void
let commands = 0
let statusRequests = 0
class TerminalFixture {
  ptyKey = 'fixture-terminal'
  destroyed = false
  detached = false
  released = false
  async initialize() {}
  async mount() {}
  unmounted() {
    this.detached = true
  }
  releaseProcessOutput() {
    this.released = true
  }
  destroy() {
    this.destroyed = true
  }
  send(command: string[], singleFile: boolean, reportExit: boolean) {
    assert.match(command[0], /sudo -- make PG_CONFIG=/)
    assert.equal(singleFile, true)
    assert.equal(reportExit, true)
    commands++
    return new Promise<void>((resolve) => {
      complete = resolve
    })
  }
}
const { pgvectorController, pgvectorInstallCommand } = await loadIsolated(
  'src/render-next/postgresql/PgvectorController.ts',
  {
    '@/util/Index': { reactiveBind: (value: unknown) => value },
    '@/util/XTerm': Object.assign(TerminalFixture, { TerminalExitError: Error }),
    '@/util/ForkTerminalRequest': {
      forkTerminalRequest: async (channel: string, args: string[]) => {
        assert.equal(channel, 'app-fork:postgresql')
        assert.equal(args[0], 'pgvectorStatus')
        statusRequests++
        return {
          code: 0,
          data: {
            installed,
            pgConfig: "/fixture/one's files/bin/pg_config",
            requiresAdministrator: true
          }
        }
      }
    },
    '../state/app': { showNotice: () => undefined }
  },
  { window: { Server: { isLinux: true } } }
)
assert.match(
  pgvectorInstallCommand("/fixture/one's files/bin/pg_config", false),
  /make PG_CONFIG="\$build_dir\/pg_config"/
)
const selectedPostgres = { version: '18.0.0', bin: '/fixture/pgsql18/bin/pg_ctl' }
assert.equal(await pgvectorController.check(selectedPostgres), true)
assert.equal(pgvectorController.canInstall, true)
const pending = pgvectorController.install()
assert.equal(pgvectorController.install(), pending)
await tick()
assert.equal(commands, 1)
const terminal = pgvectorController.terminal
const view = {} as HTMLElement
await pgvectorController.attach(view)
pgvectorController.detach(view)
assert.equal(terminal.detached, true)
assert.equal(terminal.destroyed, false)
assert.equal(pgvectorController.phase, 'installing')
assert.equal(
  pgvectorController.check({ version: '17.1.0', bin: '/fixture/pgsql17/bin/pg_ctl' }),
  pending
)
assert.equal(pgvectorController.target.version, selectedPostgres.version)
installed = true
complete()
assert.equal(await pending, true)
assert.equal(statusRequests, 2)
assert.equal(terminal.released, true)
assert.equal(pgvectorController.phase, 'installed')

installed = false
assert.equal(await pgvectorController.check({ version: '17.1.0', bin: '/fixture/pgsql17/bin/pg_ctl' }), true)
const unverified = pgvectorController.install()
await tick()
complete()
assert.equal(await unverified, false)
assert.equal(pgvectorController.phase, 'failed')
assert.match(pgvectorController.message, /could not be verified/)
assert.equal(pgvectorController.canInstall, false)

console.log(
  'Forge database details passed: selected versions, connection metadata, Qdrant configuration and dashboard, section-aware SQL edits, and pgvector lifecycle.'
)
