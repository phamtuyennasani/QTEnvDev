import assert from 'node:assert/strict'
import { CapturerOperation, CapturerOutcomeUnknown } from '../src/render-next/state/CapturerOperation'
import { capturerFileName, validateCapturerName, type CapturerConfig, type CapturerEvent } from '../src/shared/CapturerContract'
import { CapturerSaveOperation } from '../src/render/capturer/CapturerSaveOperation'
const legacy = { key: ['Control','Shift','C'], dir: 'C:/captures', name: 'shot-{index}', trialStartTime: 100 }
let persisted: CapturerConfig | undefined
let event!: (value: CapturerEvent) => void
let state: CapturerEvent = { id: '', status: 'idle' }; let calls = 0; let disposed = 0; let unknown = false
const requests: Array<[string, ...unknown[]]> = []
const deps = {
  load: async () => persisted,
  legacy: async () => legacy,
  save: async (config: CapturerConfig) => { persisted = JSON.parse(JSON.stringify(config)) },
  request: async (command: string, ...args: unknown[]) => {
    requests.push([command, ...args])
    if (command === 'Capturer:status') return state
    if (command === 'Capturer:doCapturer') { calls++; if (unknown) throw new CapturerOutcomeUnknown('lost ack'); state = { id: String(args[1]), status: 'opening' }; return state }
    if (command === 'Capturer:doStopCapturer') { state = { id: state.id, status: 'cancelled' }; event(state); return state }
    return true
  },
  subscribe: (callback: (value: CapturerEvent) => void) => { event = callback; return () => { disposed++ } },
  id: () => 'operation-' + calls, now: () => 1000, active: () => false
}
const controller = new CapturerOperation(deps)
const initial = controller.init(); assert.equal(initial, controller.init()); assert.equal(await initial, true)
assert.deepEqual(controller.config, legacy); assert.equal(persisted?.trialStartTime, 100)
const form = { ...legacy, key: [...legacy.key] }
const first = controller.capture(true, form); assert.equal(controller.capture(true, form), first)
form.name = 'changed-after-click'
assert.equal(await first, true); assert.equal(calls, 1); assert.equal(controller.running, true); assert.equal(controller.outcome, 'opening')
const sentConfig = requests.find(([command]) => command === 'Capturer:Config-Update')?.[1] as CapturerConfig
assert.equal(sentConfig.name, 'shot-{index}')
event({ id: 'stale', status: 'saved', path: 'wrong.png' }); assert.equal(controller.running, true)
event({ id: 'operation-0', status: 'opened' }); assert.equal(controller.outcome, 'opened'); assert.equal(controller.running, true)
event({ id: 'operation-0', status: 'saving' }); assert.equal(controller.running, true)
event({ id: 'operation-0', status: 'saved', path: 'C:/captures/shot-1.png', warning: 'Reveal failed' })
assert.equal(controller.running, false); assert.equal(controller.path, 'C:/captures/shot-1.png'); assert.equal(controller.warning, 'Reveal failed')
await controller.capture(); assert.equal(await controller.cancel(), true); assert.equal(controller.outcome, 'cancelled')
unknown = true; assert.equal(await controller.capture(), false); assert.equal(controller.outcome, 'unknown'); assert.equal(controller.running, true)
const count = calls; assert.equal(await controller.capture(), false); assert.equal(calls, count, 'Unknown outcome blocks replay')
state = { id: '', status: 'idle' }; assert.equal(await controller.reconcile(), true); assert.equal(controller.running, false)
controller.dispose(); assert.equal(disposed, 1)
const olderTrial = new CapturerOperation({ ...deps, load: async () => ({ ...legacy, trialStartTime: 900 }), request: async () => state })
await olderTrial.init(); assert.equal(olderTrial.config.trialStartTime, 100, 'Migration cannot reset the legacy trial')
const expiredTrial = new CapturerOperation({ ...deps, now: () => 400000 })
await expiredTrial.init(); const priorCalls = calls
assert.equal(await expiredTrial.capture(), false); assert.match(expiredTrial.error, /trial has ended/); assert.equal(calls, priorCalls)
const failedSettings = new CapturerOperation({ ...deps, request: async (command: string) => { if (command === 'Capturer:Config-Update') throw new Error('shortcut busy'); return state } })
await failedSettings.init()
assert.equal(await failedSettings.saveConfig({ ...legacy, key: ['Control','C'] }), false); assert.match(failedSettings.error, /shortcut busy/)
let finishLoad!: (value: CapturerConfig) => void
let migratedSaved: CapturerConfig | undefined
const coldSettings = new CapturerOperation({ ...deps, load: () => new Promise<CapturerConfig>((resolve) => { finishLoad = resolve }), active: () => true, save: async (value) => { migratedSaved = value } })
const coldSave = coldSettings.saveConfig()
await Promise.resolve()
assert.equal(coldSettings.saving, true)
assert.equal(await coldSettings.capture(), false, 'A pending settings save blocks capture')
finishLoad({ ...legacy, name: 'persisted-{index}' })
assert.equal(await coldSave, true)
assert.equal(migratedSaved?.name, 'persisted-{index}', 'Saving before init must use persisted settings')
assert.equal(migratedSaved?.trialStartTime, legacy.trialStartTime, 'Cold settings save preserves trial migration')

let finishConfig!: () => void
let nativeStarts = 0
let holdConfig = false
const pendingLaunch = new CapturerOperation({
  ...deps,
  active: () => true,
  request: async (command: string) => {
    if (command === 'Capturer:doCapturer') nativeStarts++
    if (command === 'Capturer:Config-Update' && holdConfig) await new Promise<void>((resolve) => { finishConfig = resolve })
    return { id: '', status: 'idle' }
  }
})
await pendingLaunch.init()
holdConfig = true
const launch = pendingLaunch.capture()
await Promise.resolve()
assert.equal(await pendingLaunch.cancel(), true)
finishConfig()
assert.equal(await launch, false)
assert.equal(nativeStarts, 0, 'Stop during configuration must prevent dispatching a late native start')
assert.equal(pendingLaunch.running, false)

let exportCount = 0
let resolveExport!: (value: string) => void
let resolveNativeSave!: (value: CapturerEvent) => void
let savedPayload = ''
const overlaySave = new CapturerSaveOperation({
  exportImage: () => { exportCount++; return new Promise<string>((resolve) => { resolveExport = resolve }) },
  hide: async () => true,
  save: (payload) => { savedPayload = payload; return new Promise<CapturerEvent>((resolve) => { resolveNativeSave = resolve }) }
}, 5)
const exportFlight = overlaySave.save(true)
assert.equal(overlaySave.save(false), exportFlight)
await Promise.resolve()
assert.equal(exportCount, 1)
resolveExport('data:image/png;base64,cG5n')
await new Promise((resolve) => setTimeout(resolve, 10))
assert.equal(overlaySave.busy, true)
assert.match(overlaySave.error, /unknown/)
assert.equal(overlaySave.save(false), exportFlight, 'Unknown save retains listener and blocks replay')
assert.equal(savedPayload, 'cG5n')
resolveNativeSave({ id: 'saved', status: 'saved', path: 'saved.png' })
assert.equal(await exportFlight, true)
assert.equal(overlaySave.busy, false)
assert.equal(overlaySave.error, '')
const exportFailure = new CapturerSaveOperation({ exportImage: async () => { throw new Error('canvas unavailable') }, hide: async () => { throw new Error('must not hide') }, save: async () => { throw new Error('must not save') } })
assert.equal(await exportFailure.save(true), false)
assert.match(exportFailure.error, /canvas unavailable/)
assert.equal(exportFailure.busy, false)
const nativeFailure = new CapturerSaveOperation({ exportImage: async () => 'data:image/png;base64,cG5n', hide: async () => true, save: async () => { throw new Error('disk unavailable') } })
assert.equal(await nativeFailure.save(true), false)
assert.match(nativeFailure.error, /disk unavailable/)
for (const invalid of ['../x', 'a/b', 'a\\b', 'a:b', '{unknown}', 'con', 'trailing.']) assert.throws(() => validateCapturerName(invalid))
assert.equal(capturerFileName('shot-{datetime}-{index}', 2, new Date('2026-11-19T12:00:00Z'), 'id'), 'shot-2026-11-19T12-00-00-000Z-2.png')
console.log('PQT Forge capturer lifecycle passed: migration/trial, cold settings save, duplicate guard, native progress/save, stale events, cancellation, unknown replay guard, overlay export/save ownership, status recovery, cleanup and safe naming.')
