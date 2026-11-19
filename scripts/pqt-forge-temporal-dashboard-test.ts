import assert from 'node:assert/strict'
import { posix } from 'node:path'
import { ForkPromise } from '../src/shared/ForkPromise'
import * as temporalUtils from '../src/fork/module/Temporal/util'
import { loadIsolated } from './helpers/load-isolated'

const serverBin = '/fixtures/apps/temporal/1.2.3/temporal-server'
const uiBin = '/fixtures/apps/temporal-ui/ui-server'
const parentPidFile = '/fixtures/data/temporal/temporal.pid'
const uiPidFile = '/fixtures/data/temporal/temporal-ui.pid'
const uiConfig = '/fixtures/data/temporal/config/temporal-ui.yaml'
const selected = { bin: serverBin, version: '1.2.3', run: true, pid: '201' }
const parent = { PID: selected.pid, COMMAND: serverBin }
const companion = { PID: '202', COMMAND: uiBin }
const files = new Map([
  [uiConfig, 'port: 48233'],
  [parentPidFile, parent.PID]
])
let processes = [parent]
let spawnCalls = 0
let releaseCalls = 0
let installCalls = 0
let installSucceeds = true
let parentExitsDuringInstall = false
let nextPid = companion.PID
const asset = 'ui-server_1.0.0_linux_amd64.tar.gz'
const { default: temporal } = await loadIsolated(
  'src/fork/module/Temporal/index.ts',
  {
    path: posix,
    fs: { existsSync: (path: string) => files.has(path) },
    axios: {
      get: async (url: string) => {
        assert.equal(url, 'https://api.github.com/repos/temporalio/ui-server/releases/latest')
        releaseCalls++
        return {
          data: {
            tag_name: 'v1.0.0',
            assets: [{ name: asset, browser_download_url: 'https://example.test/' + asset }]
          }
        }
      }
    },
    '../Base': {
      Base: class {
        pidPath = ''
        async readPidFromFile(path = this.pidPath) {
          return files.get(path) ?? ''
        }
        getAxiosProxy() {}
        installSoft(row: { bin: string; url: string }) {
          assert.equal(row.bin, uiBin)
          assert.equal(row.url, 'https://example.test/' + asset)
          installCalls++
          return new ForkPromise<boolean>((resolve, _reject, on) => {
            on({ progress: 50 })
            if (installSucceeds) files.set(uiBin, '')
            if (parentExitsDuringInstall) processes = []
            resolve(installSucceeds)
          })
        }
      }
    },
    '../../Fn': {
      readFile: async (path: string) => files.get(path)
    },
    '../../util/Zip': {},
    '../../util/ServiceStart': {
      serviceStartSpawn: async ({ bin, pidPath }: { bin: string; pidPath: string }) => {
        assert.equal(bin, uiBin)
        assert.equal(pidPath, uiPidFile)
        spawnCalls++
        files.set(uiPidFile, nextPid)
        return { 'APP-Service-Start-PID': nextPid }
      }
    },
    '@shared/ForkPromise': { ForkPromise },
    '@lang/runtime': {},
    '../../TaskQueue': {},
    '@shared/utils': { isWindows: () => false },
    '@shared/Process': {
      ProcessOwnedPidsByPid(
        pid: string,
        list: Array<{ PID: string; COMMAND: string }>,
        markers: string[]
      ) {
        return list.some((p) => p.PID === pid && markers.includes(p.COMMAND)) ? [pid] : []
      }
    },
    '@shared/StopProcessList': { fetchStopProcessListLocal: async () => processes.slice() },
    './util': temporalUtils
  },
  {
    global: {
      Server: { AppDir: '/fixtures/apps', BaseDir: '/fixtures/data', Cache: '/fixtures/cache' }
    },
    process: { platform: 'linux', arch: 'x64' }
  }
)
temporal.init()

await assert.rejects(
  async () => temporal.openUiServer({ ...selected, bin: '/fixtures/unrelated' }),
  /Start Temporal Server/
)
assert.equal(releaseCalls, 0)

installSucceeds = false
await assert.rejects(async () => temporal.openUiServer(selected), /could not be installed/)
assert.equal(spawnCalls, 0)

installSucceeds = true
parentExitsDuringInstall = true
await assert.rejects(async () => temporal.openUiServer(selected), /Start Temporal Server/)
assert.equal(spawnCalls, 0)
assert.equal(files.has(uiBin), true)

processes = [parent]
parentExitsDuringInstall = false
files.delete(uiBin)
const progress: number[] = []
const opened = await temporal
  .openUiServer({ ...selected, pid: '404' })
  .on((info: { progress: number }) => progress.push(info.progress))
assert.deepEqual(progress, [50])
assert.equal(opened.url, 'http://127.0.0.1:48233/')
assert.equal(opened['APP-Service-Start-PID'], companion.PID)
assert.equal(spawnCalls, 1)
assert.equal(releaseCalls, 3)
assert.equal(installCalls, 3)

processes = [parent, companion]
files.set(uiConfig, 'defaultNamespace: default')
const reused = await temporal.openUiServer(selected)
assert.equal(reused.url, 'http://127.0.0.1:8233/')
assert.equal(reused.running, true)
assert.equal(spawnCalls, 1)
assert.equal(installCalls, 3)
const stopArgs = temporal.companionStopArgs('openUiServer', companion.PID, [selected])
assert.equal(stopArgs[0].pid, companion.PID)
assert.equal(stopArgs[0].bin, serverBin)
assert.equal(stopArgs[1].uiOnly, true)

for (const port of ['true', '65536']) {
  files.set(uiConfig, 'port: ' + port)
  await assert.rejects(async () => temporal.openUiServer(selected), /invalid port/)
}
assert.equal(spawnCalls, 1)

files.set(uiConfig, 'port: 48233')
processes = [parent]
nextPid = '-1'
await assert.rejects(
  async () => temporal.openUiServer(selected),
  /did not report a running process/
)

const notices: string[] = []
const browserUrls: string[] = []
const requests: Array<{ command: string; args: unknown[] }> = []
let finishFork!: (reply: unknown) => void
let finishBrowser!: (reply: unknown) => void
let sendProgress!: (event: unknown) => void
const { default: controller } = await loadIsolated(
  'src/render/components/Temporal/UiController.ts',
  {
    '@/store/brew': { BrewStore: () => ({ module: () => ({ installed: [selected] }) }) },
    'element-plus': {
      ElMessage: { error: ({ message }: { message: string }) => notices.push(message) }
    },
    '@/util/ForkTerminalRequest': {
      isPositiveHostPid: (pid: string) => Number(pid) > 0,
      forkTerminalRequest: (
        command: string,
        args: unknown[],
        _timeoutMessage: string,
        _timeoutMs: number,
        progress: (event: unknown) => void
      ) => {
        requests.push({ command, args })
        sendProgress = progress
        return new Promise((resolve) => (finishFork = resolve))
      }
    },
    '@/util/NodeFn': {
      shell: {
        openExternalChecked: (url: string) => {
          browserUrls.push(url)
          return new Promise((resolve) => (finishBrowser = resolve))
        }
      }
    }
  },
  { URL }
)
const reply = { code: 0, data: opened }
const stale = controller.open()
assert.equal(controller.opening.value, true)
assert.equal(controller.openingLabel, 'Opening Temporal UI…')
sendProgress({ msg: { progress: 50 } })
assert.equal(controller.openingLabel, 'Downloading Temporal UI (50%)')
assert.equal(await controller.open(), false)
assert.equal(controller.openingLabel, 'Downloading Temporal UI (50%)')
selected.run = false
finishFork(reply)
assert.equal(await stale, false)
assert.equal(controller.openingLabel, undefined)
assert.equal(requests[0].command, 'app-fork:temporal')
assert.equal(requests[0].args[0], 'openUiServer')
assert.equal((requests[0].args[1] as typeof selected).run, true)
assert.equal(browserUrls.length, 0)
assert.match(notices.at(-1)!, /running Temporal installation changed/)

selected.run = true
const browserFailure = controller.open()
assert.equal(controller.openingLabel, 'Opening Temporal UI…')
finishFork(reply)
await new Promise<void>((resolve) => setImmediate(resolve))
assert.equal(controller.opening.value, true)
assert.equal(await controller.open(), false)
finishBrowser({ code: 1 })
assert.equal(await browserFailure, false)
assert.deepEqual(browserUrls, [opened.url])
assert.match(notices.at(-1)!, /browser could not open/)
assert.equal(controller.opening.value, false)

const retry = controller.open()
finishFork(reply)
await new Promise<void>((resolve) => setImmediate(resolve))
finishBrowser({ code: 0 })
assert.equal(await retry, true)

const unknown = controller.open()
finishFork({ code: 1, msg: 'Fork service request timed out; result is unknown' })
assert.equal(await unknown, false)
assert.match(notices.at(-1)!, /did not report a final result/)
assert.equal(controller.opening.value, false)
assert.equal(await controller.open(), false)
assert.equal(requests.length, 4)
assert.deepEqual(browserUrls, [opened.url, opened.url])

console.log('Forge Temporal dashboard lifecycle checks passed')
