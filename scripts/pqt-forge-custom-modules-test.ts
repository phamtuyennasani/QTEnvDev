import assert from 'node:assert/strict'
import { reactive } from 'vue'
import { loadIsolated } from './helpers/load-isolated'
import { StartupGroup } from '../src/render/components/StartupGroup/class/StartupGroup'
import { StartupGroupRunner } from '../src/render/components/StartupGroup/class/StartupGroupRunner'
import { StartupGroupCandidate } from '../src/render/components/StartupGroup/class/StartupGroupCandidate'

const command = (id: string, name: string) => ({
  id, name, comment: '', commandType: 'command', command: 'fixture command'
})
const definition = {
  id: 'custom-1', typeFlag: 'custom-1', label: 'Fixture', icon: '<svg />',
  item: [command('command-1', 'Worker 1'), command('command-2', 'Worker 2')],
  isService: true, isOnlyRunOne: false, isCustomer: true, moduleType: 'workers',
  configPath: [], logPath: []
}
const db = new Map<string, unknown>([
  ['qtenvdev-customer-module', [definition]],
  ['qtenvdev-customer-module-cate', [{ id: 'category-1', moduleType: 'workers', label: 'Workers' }]]
])
let releaseRead!: () => void
const readGate = new Promise<void>(resolve => { releaseRead = resolve })
const readKeys: string[] = []
const savedKeys: string[] = []
let failWrite = false
const localForage = {
  async getItem(key: string) {
    readKeys.push(key)
    await readGate
    return structuredClone(db.get(key))
  },
  async setItem(key: string, value: unknown) {
    savedKeys.push(key)
    if (failWrite) throw new Error('disk unavailable')
    db.set(key, structuredClone(value))
  }
}

const moduleEntry: Record<string, unknown> = {}
const store = { AppStore: () => ({ config: { setup: { common: {} } } }) }
let failedStopPid = ''
let unknownStart = false
let stopCount = 0
let startCount = 0
let gateStop: Promise<void> | undefined
const intents: string[] = []
const customer = await loadIsolated('src/render/core/ModuleCustomer.ts', {
  '@/core/Module': moduleEntry,
  '@/store/app': store,
  '@lang/index': { I18nT: (key: string) => key },
  '@/util/Element': { MessageSuccess() {}, MessageError() {} },
  '@/util/ForkTerminalRequest': {
    isPositiveHostPid: (pid: number) => pid > 0,
    async forkTerminalRequest(channel: string, args: string[]) {
      assert.match(channel, /^app-fork(?:-background)?:module-customer$/)
      intents.push(`${channel}:${args[0]}`)
      if (args[0] === 'stopService') {
        stopCount++
        await gateStop
        return args[1] === failedStopPid ? { code: 1, msg: 'permission denied' } : { code: 0 }
      }
      assert.equal(args[0], 'startService')
      startCount++
      if (unknownStart) throw new Error('timed out waiting for terminal response')
      return { code: 0, data: { 'APP-Service-Start-PID': 1000 + startCount } }
    }
  },
  '@/util/mcpServiceStatus': { beginServiceStatusPending: () => () => {}, noteServiceStatusRevision() {} }
}, { window: { Server: { isWindows: true } } })
Object.assign(moduleEntry, await loadIsolated('src/render/core/Module.ts', {
  '@/store/app': store, '@/core/ModuleCustomer': customer, localforage: localForage
}))
const notices: string[] = []
const { customModulesController: controller } = await loadIsolated('src/render-next/custom-modules/customModulesController.ts', {
  '@/core/Module': moduleEntry,
  '@/util/Index': { reactiveBind: reactive, uuid: () => 'new-category' },
  '../state/app': { showNotice: (message: string) => notices.push(message) }
})

const firstLoad = controller.load()
assert.equal(await controller.load(), false)
assert.equal(await controller.save(definition), false)
releaseRead()
assert.equal(await firstLoad, true)
assert.equal(await controller.load(), true)
assert.deepEqual(readKeys.sort(), [...db.keys()].sort())
assert.equal(controller.modules[0].label, 'Fixture')
const module = controller.modules[0]
const group = controller.groups[0]
assert.equal(await controller.removeGroup(group), false)
assert.match(controller.error, /Move the modules/)

assert.equal(await controller.service(module, module.item[0], 'start'), true)
assert.equal(await controller.service(module, module.item[1], 'start'), true)
failedStopPid = module.item[1].pid
let releaseStop!: () => void
gateStop = new Promise<void>(resolve => { releaseStop = resolve })
const removing = controller.remove(module)
assert.match(controller.pending, /Removing custom module/)
assert.equal(await controller.remove(module), false)
assert.equal(await controller.service(module, module.item[0], 'restart'), false)
assert.match(await module.item[0].start(), /definition is being changed/)
releaseStop()
assert.equal(await removing, false)
assert.match(controller.error, /permission denied.*Already stopped: Worker 1/)
assert.equal(stopCount, 2)
assert.equal(controller.modules[0], module)
assert.equal(module.item[1].run, true)
assert.deepEqual(savedKeys, [])

failedStopPid = ''
failWrite = true
assert.equal(await controller.save({ ...definition, label: 'Changed' }, module), false)
assert.match(controller.error, /disk unavailable.*Stopped commands: Worker 2/)
assert.equal(controller.modules[0], module)
assert.equal(module.item[1].run, false)
assert.equal((db.get('qtenvdev-customer-module') as typeof definition[])[0].label, 'Fixture')

failWrite = false
assert.equal(await controller.save({ ...definition, label: 'Changed', moduleType: '' }, module), true)
assert.equal((db.get('qtenvdev-customer-module') as typeof definition[])[0].label, 'Changed')
assert.equal(await controller.remove(module), false)
assert.match(controller.error, /module changed/)
assert.equal(await controller.removeGroup(group), true)
assert.equal(controller.groups.length, 0)

const updated = controller.modules[0]
unknownStart = true
assert.equal(await controller.service(updated, updated.item[0], 'start'), false)
assert.equal(updated.item[0].startOutcomeUnknown, true)
assert.equal(await controller.remove(updated), false)
assert.match(controller.error, /start could not be confirmed/)
assert.equal(await controller.service(updated, updated.item[0], 'start'), false)
assert.equal(startCount, 3)
assert.equal(controller.modules[0], updated)
assert.ok(notices.includes('Custom module saved.'))
assert.ok(!notices.includes('Custom module removed.'))

const customSource = await loadIsolated('src/render/components/StartupGroup/class/StartupGroupCustomServices.ts', {
  '@/core/Module': moduleEntry
})
const { StartupGroupRuntime } = await loadIsolated('src/render/components/StartupGroup/class/StartupGroupRuntime.ts', {
  '@/util/Index': { reactiveBind: reactive },
  './StartupGroup': { StartupGroup },
  './StartupGroupRunner': { StartupGroupRunner }
})
const calls: string[] = []
let id = 0
let mysqlRunning = false
const mysql = {
  bin: 'mysqld', path: '/fixture/mysql', version: '8', enable: true, running: false,
  get run() { return mysqlRunning },
  async start(interactive: boolean) { calls.push(`mysql-start:${interactive}`); mysqlRunning = true; return true },
  async stop(interactive: boolean) { calls.push(`mysql-stop:${interactive}`); mysqlRunning = false; return true }
}
unknownStart = false
const moduleStore = moduleEntry.AppCustomerModule as { module: any[] }
moduleStore.module = [
  (moduleEntry.createCustomerModule as (value: object) => unknown)({
    ...definition,
    label: 'Deployment workers'
  }),
  (moduleEntry.createCustomerModule as (value: object) => unknown)({
    ...definition, id: 'exclusive', label: 'Exclusive workers', isOnlyRunOne: true
  }),
  (moduleEntry.createCustomerModule as (value: object) => unknown)({
    ...definition, id: 'one-off', label: 'One-off commands', isService: false
  })
]
const runtime = new StartupGroupRuntime({
  createId: () => `step-${++id}`,
  getModules: async () => [{ typeFlag: 'mysql', isService: true }, ...customSource.listCustomStartupModules()],
  getInstalled: async (module: string) => module === 'mysql' ? [mysql] : customSource.customStartupTargets(module),
  getProjects: async () => [],
  pathExists: async () => true
})
const candidates = await runtime.listCandidates()
const existing = candidates.find((candidate: any) => candidate.item.module === 'mysql')
const custom = candidates.filter((candidate: any) => candidate.item.module === 'custom-module:custom-1')
const exclusive = candidates.filter((candidate: any) => candidate.item.module === 'custom-module:exclusive')
assert.ok(existing)
assert.equal(custom.length, 2)
assert.equal(exclusive.length, 2)
assert.equal(candidates.some((candidate: any) => candidate.item.module === 'custom-module:one-off'), false)
const pick = new StartupGroupCandidate(() => `step-${++id}`)
assert.equal(pick.updateSelection([custom[0].key], custom[1], candidates, true).length, 2)
assert.equal(pick.updateSelection([exclusive[0].key], exclusive[1], candidates, true).length, 1)
const startupGroup = new StartupGroup({
  id: 'custom-group', name: 'Fixture group', createdAt: 0, updatedAt: 0,
  items: [existing.item, custom[0].item, custom[1].item]
}, runtime.runner)
const savedGroup = JSON.parse(JSON.stringify(startupGroup.toJSON()))
const reloadedGroup = new StartupGroup(savedGroup, runtime.runner)
const started = await reloadedGroup.start(false)
assert.deepEqual(Array.from(started.members, (member: any) => member.outcome), ['started', 'started', 'started'])
assert.equal(await runtime.runner.getItemState(custom[0].item), 'running')
const stopped = await reloadedGroup.stop(false)
assert.deepEqual(Array.from(stopped.members, (member: any) => member.item.versionPath), ['command-2', 'command-1', '/fixture/mysql'])
assert.deepEqual(calls, ['mysql-start:false', 'mysql-stop:false'])
assert.deepEqual(intents.slice(-4), [
  'app-fork-background:module-customer:startService', 'app-fork-background:module-customer:startService',
  'app-fork-background:module-customer:stopService', 'app-fork-background:module-customer:stopService'
])
moduleStore.module.shift()
const missing = await reloadedGroup.start(false)
assert.deepEqual(Array.from(missing.members, (member: any) => member.outcome), ['started', 'invalid', 'invalid'])
assert.equal(await runtime.runner.getItemState(custom[0].item), 'invalid')

console.log('PQT Forge custom modules passed: settings mutations, startup group selection, saved mixed groups, start/stop order, background intent and removed targets.')
