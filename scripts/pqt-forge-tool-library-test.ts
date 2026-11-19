import assert from 'node:assert/strict'
import { ToolLibraryController, customToolUrl, type ToolLibraryData } from '../src/render-next/state/ToolLibraryModel'

const clone = <T>(data: T): T => JSON.parse(JSON.stringify(data))
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done }); return { resolve, promise } }
let saved: ToolLibraryData | undefined
let loads = 0; let legacyReads = 0; let id = 0; let failSave = false
const legacy = { like: ['JsonParse', 'mine', 'PortKill'], custom: [{ id: 'mine', label: 'My app', component: 'https://example.com/tool' }, { id: '', label: 'bad', component: 'oops' }, { id: 'alias', label: 'JSON shortcut', component: 'json' }] }
const deps = {
  load: async () => { loads++; return saved },
  save: async (data: ToolLibraryData) => { if (failSave) throw new Error('disk failed'); saved = clone(data) },
  readLegacy: async () => { legacyReads++; return clone(legacy) },
  id: () => String(++id), aliases: ['json', 'process'], openExternal: async (_url: string) => undefined
}
const library = new ToolLibraryController(deps)
const first = library.init(); assert.equal(first, library.init())
assert.equal(await first, true); assert.equal(loads, 1); assert.equal(legacyReads, 1)
assert.deepEqual(library.favorites, ['json', 'mine', 'process']); assert.equal(library.custom.length, 2)
assert.match(library.warning, /1 invalid/); assert.deepEqual(legacy.custom[0], { id: 'mine', label: 'My app', component: 'https://example.com/tool' })
assert.equal(await library.addCustom('New site', 'https://new.example'), true)
const added = library.custom[0]; assert.equal(added.component, 'https://new.example/')
assert.equal(await library.toggleFavorite(added.id), true); assert.equal(library.isFavorite(added.id), true)
assert.equal(await library.updateCustom(added.id, 'Renamed', 'https://next.example/app'), true); assert.equal(library.custom[0].label, 'Renamed')
assert.equal(await library.addCustom('bad', 'javascript:alert(1)'), false); assert.match(library.error, /HTTP/)
assert.equal(await library.addCustom('shortcut', 'json'), true)
failSave = true
const before = clone({ custom: library.custom, favorites: library.favorites })
assert.equal(await library.removeCustom(added.id), false)
assert.deepEqual({ custom: library.custom, favorites: library.favorites }, before, 'A failed write must not publish a deletion')
failSave = false
assert.equal(await library.removeCustom(added.id), true); assert.equal(library.isFavorite(added.id), false)
const reopened = new ToolLibraryController(deps); await reopened.init(); assert.equal(legacyReads, 1, 'Existing new storage must take precedence over migration')

const barrier = deferred<void>(); let writes = 0; let active = 0; let maxActive = 0
const queued = new ToolLibraryController({ ...deps, load: async () => ({ custom: [], favorites: [] }), save: async () => { writes++; active++; maxActive = Math.max(maxActive, active); if (writes === 1) await barrier.promise; active-- } })
await queued.init()
const a = queued.addCustom('A', 'https://a.example'); const b = queued.addCustom('B', 'https://b.example')
await Promise.resolve(); await Promise.resolve(); assert.equal(queued.saving, 2); assert.equal(queued.custom.length, 0)
barrier.resolve(); assert.equal(await a, true); assert.equal(await b, true); assert.equal(maxActive, 1); assert.equal(queued.custom.length, 2)
assert.equal(queued.saving, 0)

const handlers = new Map<string, (event: any) => void>(); let stopped = 0; let reloaded = 0
const view = { addEventListener: (name: string, fn: (event: any) => void) => { handlers.set(name, fn) }, removeEventListener: (name: string) => { handlers.delete(name) }, stop: () => { stopped++ }, reload: () => { reloaded++ }, getURL: () => 'https://example.com/tool' }
assert.equal(library.open(legacy.custom[0]), true); library.attach(view)
handlers.get('did-start-loading')?.({}); assert.equal(library.pageStatus, 'loading')
handlers.get('did-finish-load')?.({}); assert.equal(library.pageStatus, 'ready')
handlers.get('did-fail-load')?.({ errorCode: -105, errorDescription: 'DNS failed' }); assert.equal(library.pageStatus, 'failed'); assert.equal(library.pageError, 'DNS failed')
library.reload(); assert.equal(reloaded, 1); assert.equal(await library.openExternal(), true)
library.close(); assert.equal(stopped, 1); assert.equal(handlers.size, 0); assert.equal(library.opened, undefined)
assert.equal(customToolUrl('file:///etc/passwd'), undefined)
console.log('PQT Forge tool library passed: URL CRUD, favorites, read-only legacy migration, aliases, write serialization, failed-write preservation, webview lifecycle and cleanup.')
