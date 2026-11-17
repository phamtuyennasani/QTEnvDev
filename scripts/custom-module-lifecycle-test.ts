import assert from 'node:assert/strict'
import { reactive } from 'vue'
import { loadIsolated } from './helpers/load-isolated'

const requests: {
  key: string
  command: string
  args: any[]
  reply?: (key: string, info: any) => void
}[] = []
const removedListeners = new Set<string>()
const ipc = {
  send(command: string, ...args: any[]) {
    const request = { key: String(requests.length), command, args } as (typeof requests)[number]
    requests.push(request)
    return {
      key: request.key,
      then(reply: (key: string, info: any) => void) {
        request.reply = reply
      }
    }
  },
  off(key: string) {
    removedListeners.add(key)
  }
}
const terminal = await loadIsolated('src/render/util/ForkTerminalRequest.ts', {
  '@/util/IPC': ipc
})
let activeOperations = 0
const { ModuleCustomer } = await loadIsolated(
  'src/render/core/ModuleCustomer.ts',
  {
    '@/core/Module': { AppCustomerModule: {} },
    '@/util/Element': { MessageError() {}, MessageSuccess() {} },
    'element-plus': { ElMessageBox: {} },
    '@lang/index': { I18nT: (key: string) => key },
    '@/store/app': { AppStore: () => ({}) },
    '@/util/ForkTerminalRequest': terminal,
    '@/util/mcpServiceStatus': {
      beginServiceStatusPending() {
        activeOperations++
        return () => activeOperations--
      },
      noteServiceStatusRevision() {}
    }
  },
  { window: { Server: { isWindows: true } } }
)
const createModule = () =>
  reactive(new ModuleCustomer({ id: 'test-custom', isService: true, item: [{ id: 'one' }] }))
const runningModule = () => {
  const module = createModule()
  module.item[0].run = true
  module.item[0].pid = '123'
  return module
}
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
const reply = (index: number, info: any) => {
  const request = requests[index]
  request.reply!(request.key, info)
}

const item = runningModule().item[0]
let index = requests.length
const firstStop = item.stop(false)
assert.equal(item.stop(false), firstStop, 'duplicate stops wait for the same result')
await tick()
assert.equal(requests.length, index + 1)
assert.equal(requests[index].command, 'app-fork-background:module-customer')
reply(index, { code: 200, data: 'stopping' })
await tick()
assert.equal(item.running, true)
assert.equal(item.pid, '123')
assert.equal(activeOperations, 1)
assert.equal(removedListeners.has(requests[index].key), false)
reply(index, { code: 0 })
assert.equal(await firstStop, true)
assert.equal(item.pid, '')
assert.equal(item.running, false)
assert.equal(activeOperations, 0)
assert.equal(removedListeners.has(requests[index].key), true)

item.run = true
item.pid = '456'
index = requests.length
const failedStop = item.stop()
await tick()
reply(index, { code: 1, msg: 'permission denied' })
assert.equal(await failedStop, 'permission denied')
assert.equal(item.run, true)
assert.equal(item.pid, '456')
assert.equal(item.running, false)
index = requests.length
const retry = item.stop()
await tick()
reply(index, { code: 0 })
assert.equal(await retry, true)

const starting = createModule().item[0]
index = requests.length
const start = starting.start(false)
assert.equal(starting.start(false), start)
await tick()
assert.equal(requests[index].args[0], 'startService')
reply(index, { code: 200 })
const stopAfterStart = starting.stop(false)
assert.equal(starting.stop(false), stopAfterStart)
await tick()
assert.equal(requests.length, index + 1, 'stop waits until startup reaches its terminal result')
reply(index, { code: 0, data: { 'APP-Service-Start-PID': '789' } })
assert.equal(await start, true)
await tick()
assert.equal(requests.length, index + 2)
assert.equal(requests[index + 1].args[0], 'stopService')
assert.equal(requests[index + 1].args[1], '789')
reply(index + 1, { code: 0 })
assert.equal(await stopAfterStart, true)
assert.equal(starting.run, false)
assert.equal(starting.pid, '')

const group = runningModule()
group.item.push(runningModule().item[0])
index = requests.length
const stopGroup = group.stop(false)
await tick()
assert.equal(requests.length, index + 2)
reply(index, { code: 1, msg: 'still running' })
reply(index + 1, { code: 0 })
assert.equal(await stopGroup, 'still running')
assert.equal(group.item[0].pid, '123')
assert.equal(group.item[1].pid, '')
assert.equal(activeOperations, 0)
assert.equal(removedListeners.size, requests.length)
console.log(
  'Custom module reactive lifecycle: duplicates, progress, failure/retry, startup ordering and partial stop passed'
)
