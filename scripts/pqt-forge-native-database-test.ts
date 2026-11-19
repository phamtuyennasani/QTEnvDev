import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'
import { createConnection } from 'mysql2/promise'
import mysql from '../src/fork/module/Mysql'
import mariadb from '../src/fork/module/Mariadb'
import type { SoftInstalled } from '../src/shared/app'

const [engine, argument] = process.argv.slice(2)
if (process.platform !== 'win32' || (engine !== 'mysql' && engine !== 'mariadb') || !argument) {
  throw new Error(
    'On Windows, pass mysql or mariadb followed by the full path to its server executable.'
  )
}
const exec = promisify(execFile)
const bin = resolve(argument)
const isMysql = engine === 'mysql'
const backend = isMysql ? mysql : mariadb
const rootPassword = 'ForgeDatabaseFixtureRoot'
const userPassword = 'ForgeDatabaseFixtureUser'
const user = 'forge_fixture_user'
const database = 'forge_fixture'
const basedir = dirname(dirname(bin))
const options = { windowsHide: true, timeout: 60_000 }
const { stdout: versionLine } = await exec(bin, ['--version'], options)
const version = versionLine.match(/\b(\d+\.\d+\.\d+)\b/)?.[1]
assert(version, 'Could not read database server version')
const endpoint = createServer()
const port = await new Promise<number>((done, fail) => {
  endpoint.once('error', fail)
  endpoint.listen(0, '127.0.0.1', () => {
    const address = endpoint.address()
    assert(address && typeof address !== 'string')
    endpoint.close((error) => (error ? fail(error) : done(address.port)))
  })
})
const connect = (user: string, password: string) =>
  createConnection({ user, password, host: '127.0.0.1', port, connectTimeout: 1000 })
const root = await mkdtemp(join(tmpdir(), 'pqt-forge-db-'))
const backup = join(root, 'backup')
const datadir = join(root, 'data')
const config = join(root, 'my-' + version.split('.').slice(0, 2).join('.') + '.cnf')
const previousServer = global.Server

try {
  await mkdir(datadir)
  global.Server = { BaseDir: root, MysqlDir: root, MariaDBDir: root } as typeof global.Server
  const configPath = (path: string) => path.replaceAll('\\', '/')
  await writeFile(
    config,
    [
      '[mysqld]',
      'basedir=' + configPath(basedir),
      'datadir=' + configPath(datadir),
      'bind-address=127.0.0.1',
      'port=' + port,
      isMysql ? 'mysqlx=OFF' : '',
      ''
    ].join('\n')
  )
  if (isMysql) {
    await exec(bin, ['--defaults-file=' + config, '--initialize-insecure'], options)
  } else {
    const candidates = ['mariadb-install-db.exe', 'mysql_install_db.exe']
    const installed = await readdir(dirname(bin))
    const initializer = candidates.find((name) => installed.includes(name))
    assert(initializer, 'Missing MariaDB database initializer')
    await exec(
      join(dirname(bin), initializer),
      ['--datadir=' + datadir, '--password=' + rootPassword, '--port=' + port],
      options
    )
  }

  const child = spawn(bin, ['--defaults-file=' + config, '--console'], {
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe']
  })
  let stderr = ''
  child.stderr.on('data', (data) => {
    stderr = (stderr + data).slice(-5000)
  })
  let launchError: Error | undefined
  let administratorPassword = isMysql ? '' : rootPassword
  let ready = false
  child.once('error', (error) => {
    launchError = error
  })
  const closed = new Promise<void>((done) => child.once('close', () => done()))
  try {
    let administrator: Awaited<ReturnType<typeof connect>> | undefined
    const deadline = Date.now() + 20_000
    while (!administrator) {
      if (launchError) throw launchError
      assert.equal(child.exitCode, null, stderr)
      try {
        administrator = await connect('root', administratorPassword)
      } catch (error) {
        if (Date.now() >= deadline) throw error
        await delay(150)
      }
    }
    ready = true
    try {
      if (isMysql) {
        await administrator.query('ALTER USER ?@? IDENTIFIED BY ?', [
          'root',
          'localhost',
          rootPassword
        ])
        administratorPassword = rootPassword
      }
    } finally {
      await administrator.end()
    }

    const selected = { bin, path: basedir, version, rootPassword } as SoftInstalled
    assert.deepEqual(await backend.databaseConnectionEndpoint(selected), { port })
    assert.deepEqual(
      await backend.addDatabase(selected, {
        database,
        charset: 'utf8mb4',
        user,
        password: userPassword
      }),
      { userExists: false }
    )
    const connection = await connect(user, userPassword)
    try {
      await connection.query('USE forge_fixture')
      await connection.query('CREATE TABLE fixture_rows (id INT PRIMARY KEY)')
      await connection.query('INSERT INTO fixture_rows (id) VALUES (73)')
    } finally {
      await connection.end()
    }
    const catalog = (await backend.getDatabasesWithUsers(selected)) as {
      list: Array<{ name: string; users: string[] }>
    }
    assert(catalog.list.find((entry) => entry.name === database)?.users.includes(user))
    assert.deepEqual(await backend.backupDatabase(selected, [database], backup), [])
    const files = await readdir(backup)
    assert.equal(files.length, 1)
    assert.match(
      await readFile(join(backup, files[0]), 'utf8'),
      /INSERT INTO .fixture_rows. VALUES\s*\(73\)/
    )
    console.log(
      'PQT Forge native ' +
        engine +
        ' ' +
        version +
        ' passed connection, database creation, user login, discovery and backup.'
    )
  } finally {
    if (ready && child.exitCode === null) {
      try {
        const session = await connect('root', administratorPassword)
        try {
          await session.query({ sql: 'SHUTDOWN', timeout: 5000 })
        } finally {
          session.destroy()
        }
        await Promise.race([closed, delay(8000, undefined, { ref: false })])
      } catch {
        // A failed shutdown still leaves this exact child eligible for cleanup.
      }
    }
    if (child.pid && child.exitCode === null && !launchError) child.kill()
    await closed
  }
} finally {
  global.Server = previousServer
  await rm(root, { recursive: true, force: true })
}
