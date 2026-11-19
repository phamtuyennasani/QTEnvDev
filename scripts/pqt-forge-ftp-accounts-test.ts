import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ForkPromise } from '../src/shared/ForkPromise'
import {
  FtpAccountsController,
  FtpMutationUnknown
} from '../src/render-next/ftpAccounts/Controller'
import { loadIsolated } from './helpers/load-isolated'

const dir = await mkdtemp(join(tmpdir(), 'pqt-ftp-'))
const account = { user: 'alpha', pass: 'fixture', dir, mark: '', disabled: false }
const second = { ...account, user: 'beta' }
try {
  let failedListen = true
  let stops = 0
  const { default: fork } = await loadIsolated(
    'src/fork/module/FTPSrv/index.ts',
    {
      '../Base': { Base: class {} },
      '@shared/ForkPromise': { ForkPromise },
      'ftp-srv': class {
        on() {
          return this
        }
        async listen() {
          if (failedListen) throw new Error('fixture bind failed')
        }
        async close() {
          stops++
        }
      },
      '../../Fn': {
        readFile,
        writeFile,
        mkdirp: (path: string) => mkdir(path, { recursive: true })
      },
      '@shared/utils': { isWindows: () => false },
      '@shared/network': {},
      fs: { existsSync }
    },
    { global: { Server: { BaseDir: dir } } }
  )
  await assert.rejects(Promise.resolve(fork._startServer()), /fixture bind failed/)
  assert.equal((await fork.workspaceStatus()).running, false)
  failedListen = false
  await fork._startServer()
  assert.equal((await fork.workspaceStatus()).running, true)
  await fork._stopServer()
  assert.equal(stops, 1)
  assert.equal((await fork.workspaceStatus()).running, false)

  await Promise.all([fork.addFtp(account), fork.addFtp(second)])
  assert.deepEqual(
    Array.from(await fork.getAllFtp(), (item: { user: string }) => item.user),
    ['beta', 'alpha']
  )
  await fork.delFtp(account)
  assert.deepEqual(JSON.parse(JSON.stringify(await fork.getAllFtp())), [second])
  const path = join(dir, 'ftp-srv', 'ftp-srv.json')
  await writeFile(path, '{invalid')
  await assert.rejects(Promise.resolve(fork.addFtp(account)), /JSON|Expected/)
  assert.equal(await readFile(path, 'utf8'), '{invalid')
} finally {
  await rm(dir, { recursive: true, force: true })
}

let committed = false
let failRefresh = false
let unknown = false
let writes = 0
let finish!: () => void
const controller = new FtpAccountsController({
  status: async () => ({ installed: true, running: false }),
  accounts: async () => {
    if (failRefresh) throw new Error('fixture refresh failed')
    return committed ? [account] : []
  },
  change: async () => undefined,
  write: async () => {
    writes++
    if (unknown) throw new FtpMutationUnknown('fixture unknown')
    await new Promise<void>((resolve) => {
      finish = resolve
    })
    committed = true
    failRefresh = true
    return 'fixture runtime warning'
  },
  folder: async () => undefined,
  open: async () => undefined,
  copy: async () => undefined,
  addresses: async () => []
})
await controller.refresh()
const first = controller.save(account, false)
assert.equal(await controller.save(second, false), false)
assert.equal(writes, 1)
finish()
assert.equal(await first, true)
assert.match(controller.message, /account added/)
assert.match(controller.warning, /runtime warning[\s\S]*refresh failed/)
assert.equal(await controller.remove(account), false)
failRefresh = false
assert.equal(await controller.refresh(), true)
assert.deepEqual(controller.accounts, [account])
unknown = true
assert.equal(await controller.remove(account), false)
assert.match(controller.error, /unknown/)
assert.equal(controller.accountsVerified, false)

let nativeStarted = 0
const installed: unknown[] = []
const { ftpAccounts } = await loadIsolated('src/render-next/ftpAccounts/state.ts', {
  './Controller': { FtpAccountsController, FtpMutationUnknown },
  '@/store/brew': {
    BrewStore: () => ({
      module: () => ({ installed, fetchInstalled: async () => true }),
      currentVersion: () => ({ version: '1.0', bin: 'pure-ftpd' })
    })
  },
  '@/store/app': {
    AppStore: () => ({
      config: {
        server: { 'pure-ftpd': { current: { path: '/fixture/native', version: '1.0.52' } } }
      }
    })
  },
  '@/core/DataDirectoryStartup': { ensureDataDirectoryReady: async () => true },
  '@/util/ForkTerminalRequest': {
    forkTerminalRequest: async (_channel: string, [action]: string[]) => ({
      code: 0,
      data: action === 'getPort' ? 21 : []
    })
  },
  '@/util/Index': { reactiveBind: (value: unknown) => value },
  '@/util/NodeFn': { clipboard: {}, dialog: {}, shell: {}, ip: { addressList: async () => [] } }
})
const pure = ftpAccounts['pure-ftpd']
assert.equal(await pure.refresh(), true)
assert.equal(pure.status?.installed, false)
assert.equal(await pure.change('start'), false)
installed.push(
  { enable: true, version: '1.0.50', path: '/fixture/other', start: async () => false },
  {
    enable: true,
    version: '1.0.52',
    path: '/fixture/native',
    start: async () => {
      nativeStarted++
      return true
    }
  }
)
assert.equal(await pure.refresh(), true)
assert.equal(pure.status?.installed, true)
assert.equal(await pure.change('start'), true)
assert.equal(nativeStarted, 1)
console.log(
  'FTP accounts passed with confirmed service state, serialized saves and partial result reporting.'
)
