import assert from 'node:assert/strict'
import { join } from 'node:path'
import { reactive } from 'vue'
import { isHomebrewMirror } from '../src/shared/homebrewMirrors'
import { PackageOutcomeUnknown } from '../src/render-next/packages/types'
import * as mirrorTypes from '../src/shared/homebrewMirrors'
import * as packageTypes from '../src/render-next/packages/types'
import * as forkPromise from '../src/shared/ForkPromise'
import { loadIsolated } from './helpers/load-isolated'

assert.equal(isHomebrewMirror('tsinghua'), true)
assert.equal(isHomebrewMirror('constructor'), false)
assert.equal(isHomebrewMirror('unlisted'), false)

const brewHome = '/fixture/Homebrew space'
const shellCalls: unknown[][] = []
let remotes = 'https://mirrors.bfsu.edu.cn/git/homebrew/brew.git'
let shellResult = 'QTENVDEV_BREW_MIRROR_APPLIED'
let shellWait = Promise.resolve()
let environmentInvalidations = 0
const { default: backend } = await loadIsolated(
  'src/fork/module/Brew/index.ts',
  {
    '../Base': { Base: class {} },
    './UpgradeCatalog': {},
    './BrewPackageRunner': { BrewPackageRunner: class {} },
    '../../Fn': {
      async spawnPromiseWithEnv(...args: unknown[]) {
        shellCalls.push(args)
        if (args[0] !== 'git') await shellWait
        return { stdout: args[0] === 'git' ? remotes : shellResult }
      }
    },
    '@shared/EnvSync': {
      clean: async () => {
        environmentInvalidations++
      }
    },
    '@shared/ForkPromise': forkPromise,
    '@shared/homebrewMirrors': mirrorTypes
  },
  {
    process: { platform: 'darwin' },
    global: { Server: { BrewHome: brewHome, Static: '/fixture/assets space' } }
  }
)
assert.equal(await backend.currentSrc(), 'bfsu')
assert.deepEqual(JSON.parse(JSON.stringify(shellCalls.at(-1))), [
  'git',
  [`--git-dir=${join(brewHome, '.git')}`, 'remote', 'get-url', 'origin'],
  { cwd: brewHome, shell: false }
])
remotes = 'https://git.example.test/bfsu.edu.cn/homebrew.git'
assert.equal(await backend.currentSrc(), 'custom')
await assert.rejects(async () => await backend.changeSrc('unlisted'), /supported Homebrew mirror/)
assert.equal(shellCalls.length, 2)
const release = Promise.withResolvers<void>()
shellWait = release.promise
const switchMirror = backend.changeSrc('bfsu')
await assert.rejects(async () => await backend.changeSrc('default'), /already running/)
release.resolve()
assert.equal(await switchMirror, true)
assert.deepEqual(JSON.parse(JSON.stringify(shellCalls.at(-1))), [
  '/bin/zsh',
  ['-f', join('/fixture/assets space', 'sh/brew-src.sh'), 'bfsu', brewHome],
  { cwd: brewHome, shell: false }
])
shellResult = ''
await assert.rejects(async () => await backend.changeSrc('default'), /could not be confirmed/)
assert.equal(environmentInvalidations, 2)

type Reply = { code: number; data?: unknown; msg?: string }
type Receiver = (key: string, reply: Reply) => void
const callbacks = new Map<string, Receiver>()
const sends: string[][] = []
const notices: string[] = []
const timers = new Map<number, () => void>()
let timerId = 0
const brew = reactive({ brewSrc: '', brewRunning: false })
const { homebrewMirrorController: controller } = await loadIsolated(
  'src/render-next/state/homebrewMirrorController.ts',
  {
    '@/store/brew': { BrewStore: () => brew },
    '@/util/Index': { reactiveBind: reactive },
    '@/util/IPC': {
      send(command: string, ...args: string[]) {
        sends.push([command, ...args])
        const key = `ipc-${sends.length}`
        return { key, then: (callback: Receiver) => callbacks.set(key, callback) }
      },
      off(key: string) {
        callbacks.delete(key)
      }
    },
    '../packages/transport': await loadIsolated(
      'src/render-next/packages/transport.ts',
      { './types': packageTypes },
      {
        setTimeout(callback: () => void) {
          timers.set(++timerId, callback)
          return timerId
        },
        clearTimeout(id: number) {
          timers.delete(id)
        }
      }
    ),
    '../packages/types': { ...packageTypes, PackageOutcomeUnknown },
    '@shared/homebrewMirrors': mirrorTypes,
    './app': { showNotice: (message: string) => notices.push(message) }
  },
  { window: { Server: { isMacOS: true, BrewHome: brewHome } } }
)
assert.equal(await controller.apply('bfsu'), false)
const loading = controller.refresh()
callbacks.get('ipc-1')?.('ipc-1', { code: 0, data: 'custom' })
await loading
assert.equal(controller.current, 'custom')

const applying = controller.apply('bfsu')
const listener = callbacks.get('ipc-2')!
listener('ipc-2', { code: 200 })
assert.equal(controller.applying, true)
assert.equal(await controller.apply('default'), false)
assert.equal(callbacks.size, 1)
listener('ipc-2', { code: 0, data: true })
assert.equal(await applying, true)
assert.equal(controller.current, 'bfsu')
assert.deepEqual(notices, ['Homebrew mirror changed.'])

const failed = controller.apply('default')
callbacks.get('ipc-3')?.('ipc-3', { code: 1, msg: 'Profile write failed' })
assert.equal(await failed, false)
assert.equal(controller.current, '')
assert.match(controller.error, /Some settings may have changed/)
assert.equal(await controller.apply('default'), false)
const refreshed = controller.refresh()
callbacks.get('ipc-4')?.('ipc-4', { code: 0, data: 'default' })
await refreshed
const pending = controller.apply('default')
const lateReply = callbacks.get('ipc-5')!
Array.from(timers.values()).at(-1)!()
assert.equal(await pending, false)
assert.equal(controller.unknown, true)
lateReply('ipc-5', { code: 0, data: true })
assert.equal(await controller.apply('default'), false)
await controller.refresh()
assert.equal(sends.length, 5)
assert.equal(callbacks.size, 0)
assert.equal(timers.size, 0)
assert.deepEqual(notices, ['Homebrew mirror changed.'])

console.log(
  'Homebrew mirrors passed: supported selections, argv-safe paths, verified terminal results, partial failure and timeout replay guard.'
)
