import assert from 'node:assert/strict'
import { markRaw, reactive } from 'vue'
import { loadIsolated } from './helpers/load-isolated'
import { quotePosixShell } from '../src/shared/Gvm'
import { sdkmanBash } from '../src/shared/Sdkman'
import { ForkPromise } from '../src/shared/ForkPromise'
import * as sdkmanParser from '../src/fork/module/Sdkman/parser'
import * as packageTypes from '../src/render-next/packages/types'
import * as transport from '../src/render-next/packages/transport'

const server: { isLinux: boolean; isMacOS?: boolean; SdkmanHome: string; BrewBin?: string } = {
  isLinux: true,
  SdkmanHome: "/fixture/O'Brien/.sdkman"
}
const browser = {
  Server: server,
  QTEnvDevNodeAPI: {},
  dispatchEvent: (event: Event) => events.push(event.type)
}
const events: string[] = []
let catalog: unknown = [
  { version: '21.0.8', identifier: '21.0.8-tem', vendor: 'Temurin', installed: false },
  { version: '21.0.8', identifier: '21.0.8-zulu', vendor: 'Zulu', installed: true },
  { version: '21.0.8', identifier: '21.0.8; fixture', installed: false }
]
const catalogCalls: string[] = []
const clipboard: string[] = []
const notices: string[] = []
let checks = 0
let discover = false
const ipc = {
  send(command: string, action: string, flag: string) {
    const discovery = command === 'app-refresh-sdkman'
    if (discovery) checks += 1
    else {
      assert.equal(command, 'app-fork:sdkman')
      assert.equal(action, 'sdkmaninfo')
      catalogCalls.push(flag)
    }
    return {
      key: 'fixture-request',
      then(listener: (key: string, reply: { code: number; data?: unknown; msg?: string }) => void) {
        const reply = discovery
          ? discover
            ? { code: 0, data: '/fixture/.sdkman' }
            : { code: 1, msg: 'Could not detect SDKMAN' }
          : { code: 0, data: catalog }
        queueMicrotask(() => listener('fixture-request', reply))
      }
    }
  },
  off() {}
}
const sources = await loadIsolated(
  'src/render-next/packages/sdkmanSources.ts',
  {
    '@/util/IPC': ipc,
    './transport': transport
  },
  { queueMicrotask }
)
for (const flag of ['java', 'maven', 'gradle']) {
  assert.equal(sources.supportsSdkman(flag, { isMacOS: true }), true)
  assert.equal(sources.supportsSdkman(flag, { isLinux: true }), true)
  assert.equal(sources.supportsSdkman(flag, { isWindows: true }), false)
}
assert.equal(sources.supportsSdkman('php', server), false)

const mavenOutput = [
  'Available Maven Versions',
  ' > * 3.9.14     3.8.9',
  '     4.0.0-rc-5',
  ' + local version'
].join('\n')
assert.deepEqual(
  sdkmanParser
    .parseSdkmanVersionOutput(mavenOutput, 'maven')
    .map(({ version, installed }) => [version, installed]),
  [
    ['3.9.14', true],
    ['3.8.9', false],
    ['4.0.0-rc-5', false]
  ]
)
let shell = ''
let listFailed = false
const { default: forkSdkman } = await loadIsolated(
  'src/fork/module/Sdkman/index.ts',
  {
    '../Base': { Base: class {} },
    '@shared/ForkPromise': { ForkPromise },
    '@shared/utils': { isWindows: () => false },
    '@shared/Gvm': { quotePosixShell },
    '@shared/Sdkman': { sdkmanBash },
    '@shared/compare-versions': {
      compareVersions: (left: string, right: string) => left.localeCompare(right)
    },
    './parser': sdkmanParser,
    '../../Fn': {
      versionFixed: (value: string) => value,
      execPromiseWithEnv: async (command: string) => {
        shell = command
        if (listFailed) throw new Error('fixture CLI failed')
        return { stdout: mavenOutput }
      }
    }
  },
  { global: { Server: { SdkmanHome: server.SdkmanHome } } }
)
assert.equal((await forkSdkman.sdkmaninfo('maven')).length, 3)
assert.match(shell, /sdk list maven/)
await assert.rejects(Promise.resolve(forkSdkman.sdkmaninfo('unsupported')), /not supported/)
listFailed = true
await assert.rejects(Promise.resolve(forkSdkman.sdkmaninfo('gradle')), /fixture CLI failed/)

class TerminalExitError extends Error {
  constructor(
    message: string,
    readonly exitCode?: number
  ) {
    super(message)
  }
}
const calls: {
  invocation: string
  mode: string
  reportExit: boolean
  finish: (success?: boolean) => void
}[] = []
class Terminal {
  ptyKey = ''
  dom?: HTMLElement
  async initialize() {
    this.ptyKey = 'fixture-terminal'
  }
  async mount(element: HTMLElement) {
    this.dom = element
  }
  unmounted() {
    this.dom = undefined
    events.push('detach')
  }
  destroy() {
    this.unmounted()
    events.push('destroy')
  }
  stop() {
    throw new Error('fixture terminal not reachable')
  }
  releaseProcessOutput() {
    events.push('release')
  }
  send([invocation]: string[], mode: string, reportExit: boolean) {
    return new Promise<void>((resolve, reject) => {
      calls.push({
        invocation,
        mode,
        reportExit,
        finish(success) {
          if (success === undefined) reject(new TerminalExitError('terminal lost'))
          else if (!success) reject(new TerminalExitError('command exited 1', 1))
          else resolve()
        }
      })
    })
  }
}
const { SdkmanPackagesController } = await loadIsolated(
  'src/render-next/state/sdkmanPackagesController.ts',
  {
    vue: { markRaw },
    '@/store/brew': { BrewStore: () => ({ module: () => ({ fetchInstalled: async () => true }) }) },
    '@/util/Index': { reactiveBind: reactive },
    '@/util/IPC': ipc,
    '@/util/NodeFn': { clipboard: { writeText: async (text: string) => clipboard.push(text) } },
    '@/util/XTerm': Object.assign(Terminal, { TerminalExitError }),
    '@shared/Gvm': { quotePosixShell },
    '@shared/Sdkman': { sdkmanBash },
    '../packages/transport': transport,
    '../packages/sdkmanSources': sources,
    '../packages/types': packageTypes,
    './app': { showNotice: (message: string) => notices.push(message) }
  },
  { window: browser, CustomEvent }
)
const controller = reactive(new SdkmanPackagesController())
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))
const fakeElement = {} as HTMLElement

const firstLoad = controller.load('java')
assert.equal(firstLoad, controller.load('java'))
await firstLoad
assert.deepEqual(catalogCalls, ['java'])
assert.equal(
  controller.catalog('java').rows.length,
  2,
  'Both vendors survive; invalid identifiers are discarded.'
)
await controller.copyCommand('java', '21.0.8-tem')
await controller.copyCommand('java', '21.0.8-zulu')
await controller.copyCommand('java', '21; fixture')
assert.deepEqual(clipboard, ['sdk install java 21.0.8-tem', 'sdk uninstall java 21.0.8-zulu'])
assert.equal(await controller.change('java', 'install', '21.0.8-zulu'), false)
assert.equal(await controller.change('java', 'remove', '21.0.8-tem'), false)
assert.equal(await controller.change('java', 'install', '21; fixture'), false)

const install = controller.change('java', 'install', '21.0.8-tem')
assert.equal(install, controller.change('java', 'install', '21.0.8-tem'))
assert.equal(await controller.upgrade('java'), false)
await flush()
assert.equal(controller.operation.status, 'running')
assert.equal(controller.busy, true)
assert.equal(calls[0].mode, 'direct')
assert.equal(calls[0].reportExit, true)
assert.match(calls[0].invocation, /sdk install java 21\.0\.8-tem/)
assert.equal(
  calls[0].invocation,
  'exec /bin/bash -c ' +
    quotePosixShell(
      'source ' +
        quotePosixShell(server.SdkmanHome + '/bin/sdkman-init.sh') +
        ' && sdk install java 21.0.8-tem'
    )
)
await controller.attach('java', fakeElement)
controller.detach(fakeElement)
await controller.attach('java', fakeElement)
assert.deepEqual(events, ['detach'])
assert.equal(controller.operation.status, 'running')
catalog = [{ version: '21.0.8', identifier: '21.0.8-tem', installed: true }]
calls[0].finish(true)
assert.equal(await install, true)
assert.equal(controller.operation.status, 'success')
assert.equal(controller.catalog('java').rows[0].installed, true)
assert.ok(events.includes('release') && events.includes('pqt-packages-changed'))

const upgrade = controller.upgrade('java')
await flush()
assert.match(calls[1].invocation, /sdk upgrade java'/)
calls[1].finish(false)
assert.equal(await upgrade, false)
assert.equal(controller.operation.status, 'failed')

const remove = controller.change('java', 'remove', '21.0.8-tem')
await flush()
assert.match(calls[2].invocation, /sdk uninstall java 21\.0\.8-tem/)
calls[2].finish()
assert.equal(await remove, false)
assert.equal(controller.operation.status, 'unknown')
assert.equal(await controller.change('java', 'remove', '21.0.8-tem'), false)
assert.equal(calls.length, 3)

const bootstrap = reactive(new SdkmanPackagesController())
assert.equal(await bootstrap.bootstrap('java'), false)
server.SdkmanHome = ''
server.isLinux = false
assert.equal(await bootstrap.bootstrap('java'), false)
server.isMacOS = true
server.BrewBin = "/fixture/O'Brien/bin/brew"
const setup = bootstrap.bootstrap('gradle')
assert.equal(bootstrap.bootstrap('maven'), setup)
await flush()
assert.equal(bootstrap.busy, true)
assert.equal(bootstrap.operation.status, 'running')
assert.match(calls[3].invocation, /get\.sdkman\.io/)
assert.match(calls[3].invocation, /set -e -o pipefail/)
assert.match(calls[3].invocation, /install bash/)
assert.match(calls[3].invocation, /\| "\$BASH"/)
await bootstrap.attach('gradle', fakeElement)
bootstrap.detach(fakeElement)
await bootstrap.attach('gradle', fakeElement)
calls[3].finish(true)
assert.equal(await setup, true)
assert.equal(bootstrap.operation.status, 'success')
assert.equal(bootstrap.discoveryError, 'Could not detect SDKMAN')
assert.equal(bootstrap.available, false)
assert.equal(await bootstrap.bootstrap('gradle'), false)
assert.equal(checks, 1)

discover = true
catalog = [{ version: '9.1.0', installed: true }]
assert.equal(await bootstrap.retryDiscovery(), true)
assert.equal(calls.length, 4)
assert.equal(checks, 2)
assert.equal(bootstrap.available, true)
assert.equal(bootstrap.discoveryError, '')
assert.deepEqual(catalogCalls.slice(-1), ['gradle'])
await bootstrap.copyCommand('gradle', '9.1.0')
assert.deepEqual(clipboard.slice(-1), ['sdk uninstall gradle 9.1.0'])
assert.equal(notices.at(-1), 'SDKMAN command copied.')
console.log(
  'SDKMAN provider tests passed for bootstrap, retry detection, distinct copy commands, catalog, terminal lifecycle, install, upgrade, remove and unknown recovery.'
)
