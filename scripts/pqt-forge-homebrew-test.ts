import assert from 'node:assert/strict'
import { reactive } from 'vue'
import * as sources from '../src/render-next/packages/homebrewSources'
import * as transport from '../src/render-next/packages/transport'
import * as types from '../src/render-next/packages/types'
import * as conflicts from '../src/render/components/VersionManager/brew/FormulaConflict'
import { HomebrewUpgradeController } from '../src/render/components/VersionManager/brew/UpgradeController'
import { ForkPromise } from '../src/shared/ForkPromise'
import { loadIsolated } from './helpers/load-isolated'

const requests: {
  channel: string
  args: unknown[]
  key: string
  receive?: (key: string, reply: transport.PackageReply) => void
}[] = []
const removed: string[] = []
const server = { isMacOS: true, BrewBin: '/opt/homebrew/bin/brew', BrewCellar: '/opt/homebrew/Cellar' }
const operations: string[] = []
const published: string[] = []
let release: (result: unknown) => void = () => {}
const brew = reactive(new HomebrewUpgradeController({
  async call(action, args, progress) {
    operations.push(action)
    if (action === 'getUpgradeCatalog') return { rows: [], failures: [] }
    assert.deepEqual(Array.from(args), ['install', 'homebrew/core/php'])
    progress?.('Downloading PHP')
    return new Promise((resolve) => { release = resolve })
  },
  stop: async () => true,
  refresh: async () => { throw new Error('Installed-version scan failed') },
  notify: () => {}
}))
const { homebrewPackages: controller } = await loadIsolated(
  'src/render-next/state/homebrewPackagesController.ts',
  {
    '@/util/IPC': {
      send(channel: string, ...args: unknown[]) {
        const request: (typeof requests)[number] = { channel, args, key: String(requests.length) }
        requests.push(request)
        return { key: request.key, then: (receive: typeof request.receive) => { request.receive = receive } }
      },
      off: (key: string) => removed.push(key)
    },
    '@/util/Index': { reactiveBind: reactive },
    '@/util/NodeFn': { shell: {} },
    '@/components/VersionManager/brew/Controller': { homebrewUpgrade: brew },
    '@/components/VersionManager/brew/FormulaConflict': conflicts,
    '../packages/homebrewSources': sources,
    '../packages/transport': transport,
    '../packages/types': types,
    './homebrewBootstrapController': { homebrewBootstrap: { busy: false } },
    './app': { showNotice: () => {} }
  },
  {
    window: {
      Server: server,
      QTEnvDevNodeAPI: {},
      dispatchEvent: (event: CustomEvent<string>) => published.push(event.detail)
    },
    CustomEvent: class { constructor(_name: string, public readonly init: { detail: string }) {} get detail() { return this.init.detail } }
  }
)

const reply = (index: number, response: transport.PackageReply) =>
  requests[index].receive!(requests[index].key, response)
assert.equal(sources.supportsHomebrew('php', { isWindows: true } as { isMacOS?: boolean }), false)
assert.equal(sources.supportsHomebrew('node', server), false)
assert.equal(sources.supportsHomebrew('php', server), true)
await controller.load('node')
assert.equal(requests.length, 0)

const load = controller.load('php')
assert.equal(controller.load('php'), load)
assert.equal(requests[0].channel, 'app-fork:php')
assert.deepEqual(requests[0].args, ['brewinfo', 'php'])
reply(0, { code: 200, msg: 'Querying' })
assert.equal(controller.catalog('php').loading, true)
assert.deepEqual(removed, [])
reply(0, { code: 0, data: [{ name: 'homebrew/core/php', version: '8.5', installed: false }] })
await load
assert.deepEqual(removed, ['0'])

const install = controller.change('php', 'homebrew/core/php', false)
await controller.change('php', 'homebrew/core/php', false)
assert.deepEqual(operations, ['getUpgradeCatalog', 'packageOperation'])
assert.equal(brew.logs, 'Downloading PHP')
assert.equal(controller.busy, true)
release({ operationId: 'install', action: 'install', outcome: 'succeeded', logs: '' })
await new Promise((resolve) => setImmediate(resolve))
assert.equal(requests.length, 2)
reply(1, { code: 1, msg: 'Formula refresh failed' })
await install
assert.equal(controller.catalog('php').rows[0].installed, true)
assert.equal(controller.catalog('php').error, 'Formula refresh failed')
assert.equal(brew.phase, 'succeeded')
assert.equal(brew.refreshFailed, true)
assert.equal(controller.busy, false)
assert.deepEqual(published, ['php'])

const bin = '/opt/homebrew/bin/brew'
const providerServer: Record<string, string> = { BrewError: 'Previous discovery failed' }
const calls: Array<[string, ...string[]]> = []
let cellar = '/opt/homebrew/Cellar'
const spawn = async (command: string, args: string[]) => {
  calls.push([command, ...args])
  if (command === 'git') throw new Error('Supplementary repository setup failed')
  if (command === 'which' && args[0] === 'port') throw new Error('MacPorts absent')
  assert.equal(command, bin, 'Homebrew queries must use the detected executable')
  if (args[0] === '--repo') return { stdout: '/opt/homebrew' }
  if (args[0] === '--cellar') return { stdout: cellar }
  if (args[0] === 'tap') return { stdout: args.length === 1 ? 'typesense/homebrew-tap-extra' : '' }
  if (args[0] === 'info') {
    return {
      stdout: JSON.stringify([
        { full_name: 'typesense/tap/typesense-server', installed: [], versions: { stable: '30' } }
      ])
    }
  }
  throw new Error('Unexpected command ' + args.join(' '))
}
const globals = { global: { Server: providerServer } }
const { CheckBrewOrPort, refreshMacOSHomebrew } = await loadIsolated('src/main/utils/CheckBrew.ts', {
  '@shared/utils': { isMacOS: () => true, isArmArch: () => true, isLinux: () => false },
  '@shared/child-process': { spawnPromiseWithEnv: spawn },
  'node:fs': { existsSync: (path: string) => path === bin }
}, globals)
CheckBrewOrPort(() => {})
await new Promise((resolve) => setImmediate(resolve))
assert.deepEqual(providerServer, {
  BrewBin: bin, BrewHome: '/opt/homebrew', BrewCellar: '/opt/homebrew/Cellar'
})
cellar = '  '
await assert.rejects(refreshMacOSHomebrew(), /Cellar/)
assert.equal(providerServer.BrewCellar, undefined)
cellar = '/opt/homebrew/Cellar\n'
assert.deepEqual(
  JSON.parse(JSON.stringify(await refreshMacOSHomebrew())),
  { bin, cellar: cellar.trim() }
)

const { default: brewModule } = await loadIsolated('src/fork/module/Brew/index.ts', {
  '../Base': { Base: class {} },
  './UpgradeCatalog': {},
  './BrewPackageRunner': { BrewPackageRunner: class {} },
  '../../Fn': { spawnPromiseWithEnv: spawn },
  '@shared/EnvSync': {},
  '@shared/ForkPromise': { ForkPromise }
}, globals)
assert.equal(await brewModule.addTap('typesense/homebrew-tap'), 2)
assert.deepEqual(calls.at(-1), [bin, 'tap', 'typesense/homebrew-tap'])

const { brewInfoJson, brewSearch } = await loadIsolated('src/fork/util/Version.ts', {
  '../Fn': {
    spawnPromiseWithEnv: spawn,
    execPromiseWithEnv: async (command: string) => {
      assert.match(command, /^'\/opt\/homebrew\/bin\/brew' search /)
      return { stdout: 'typesense/tap/typesense-server' }
    }
  },
  '@shared/compare-versions': {},
  '@shared/utils': {},
  './BinVersionCache': {},
  './BrewFormula': {}
}, globals)
const names = await brewSearch([], 'brew search -q --formula "/typesense-server$/"')
const rows = await brewInfoJson(names)
assert.equal(rows[0].version, '30')
assert.deepEqual(calls.at(-1), [bin, 'info', 'typesense/tap/typesense-server', '--json', '--formula'])
console.log('PQT Forge Homebrew passed: routing, progress, duplicate guard, committed success, refresh failure, and executable identity for discovery, tap, and catalog.')
