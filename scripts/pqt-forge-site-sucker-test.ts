import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MirrorOperation, type MirrorAdapter, type MirrorEvent } from '../src/main/ui/SiteSucker/Operation'
import { mirrorConfig, mirrorUrl } from '../src/main/ui/SiteSucker/Policy'
import { SiteOutcomeUnknown, SiteSuckerModel } from '../src/render-next/state/siteSuckerModel'

assert.equal(mirrorConfig({ pageLimit: '/docs', maxPages: 2 }).pageLimit, '/docs')
assert.equal(mirrorConfig({ timeout: Number.NaN, windowCount: Infinity }).timeout, 30000)
assert.equal(mirrorConfig({ maxPages: -1 }).maxPages, 1)
assert.throws(() => mirrorUrl('file:///C:/secret'))
const dir = await mkdtemp(join(tmpdir(), 'pqt-mirror-'))
try {
  const events: MirrorEvent[] = []
  let closed = 0
  const adapter: MirrorAdapter = {
    async page(url) {
      if (url.includes('/bad')) throw new Error('Independent page failed')
      return { url, html: url.endsWith('/') ? '<a href="/docs/ok">ok</a><a href="/bad">bad</a><img src="/ok.png"><img src="/large.png">' : '<p>ok</p>' }
    },
    async file(url, _config, _signal, chunk) { await chunk(Buffer.alloc(url.includes('large') ? 1024 * 1024 + 1 : 5), 'image/png') },
    async close() { closed += 1 }
  }
  const operation = new MirrorOperation('one', 'https://test.invalid/', { dir, maxImgSize: 1, maxFileSize: 1 }, adapter, (event) => events.push(event))
  const first = operation.run()
  assert.equal(first, operation.run(), 'duplicate run shares native work')
  const result = await first
  assert.equal(result.state, 'partial')
  assert.equal(result.links.filter((link) => link.state === 'success').length, 3)
  assert.equal(result.links.filter((link) => link.state === 'fail').length, 2)
  assert.match(await readFile(join(dir, 'test.invalid', 'index.html'), 'utf8'), /assets\//)
  assert.equal(closed, 1)
  assert.equal(events.filter((event) => event.kind === 'terminal').length, 1)
  const assets = await readdir(join(dir, 'test.invalid', 'assets'))
  assert.equal(assets.some((name) => name.includes('.part-')), false, 'oversize partial file removed')
  const limited = await new MirrorOperation('two', 'https://test.invalid/', { dir, pageLimit: '/docs', maxPages: 1, maxFiles: 1 }, adapter, () => {}).run()
  assert.equal(limited.links.filter((link) => link.type === 'text/html').length, 1)
  assert.equal(limited.state, 'partial')
  const cancelledAdapter: MirrorAdapter = {
    page: async (_url, _config, signal) => new Promise((_resolve, reject) => { if (signal.aborted) reject(new Error('abort')); else signal.addEventListener('abort', () => reject(new Error('abort')), { once: true }) }),
    file: adapter.file, close: adapter.close
  }
  let started!: () => void
  const begun = new Promise<void>((resolve) => { started = resolve })
  const cancelled = new MirrorOperation('three', 'https://test.invalid/', { dir }, cancelledAdapter, (event) => { if (event.kind === 'link' && event.link.state === 'running') started() })
  const pending = cancelled.run()
  await begun
  await cancelled.cancel()
  assert.equal((await pending).state, 'cancelled')
  const cssAdapter: MirrorAdapter = {
    async page(url) { return { url, html: '<link href="/css/app.css" rel="stylesheet"><img srcset="/images/bg.png 1x"><style>p{background:url(/images/bg.png)}</style><p style="background:url(/images/bg.png)">ok</p>' } },
    async file(url, _config, _signal, chunk) { await chunk(Buffer.from(url.endsWith('.css') ? 'body{background:url(../images/bg.png)}@import "nested.css";' : 'asset'), url.endsWith('.css') ? 'text/css' : 'image/png') },
    close: async () => {}
  }
  const cssResult = await new MirrorOperation('css', 'https://css.invalid/', { dir, maxFiles: 3 }, cssAdapter, () => {}).run()
  assert.equal(cssResult.state, 'completed')
  assert.equal(cssResult.links.filter((link) => link.file?.startsWith('assets/')).length, 3, 'CSS discoveries remain bounded and deduplicated')
  assert.equal(cssResult.links.some((link) => link.url === 'https://css.invalid/images/bg.png'), true)
  const cssLink = cssResult.links.find((link) => link.url === 'https://css.invalid/css/app.css')!
  const savedCss = await readFile(join(dir, 'css.invalid', cssLink.file!), 'utf8')
  assert.doesNotMatch(savedCss, /images\/bg/); assert.match(savedCss, /url\([a-f0-9]+\.png\)/)
  const savedHtml = await readFile(join(dir, 'css.invalid', 'index.html'), 'utf8')
  assert.match(savedHtml, /srcset="assets\//); assert.doesNotMatch(savedHtml, /url\(\/images/)
  let attempts = 0
  const retryResult = await new MirrorOperation('retry', 'https://retry.invalid/', { dir, maxRetryTimes: 2 }, { ...adapter, page: async (url) => { attempts++; if (attempts === 1) throw new Error('temporary network error'); return { url, html: '<p>retried</p>' } } }, () => {}).run()
  assert.equal(attempts, 2); assert.equal(retryResult.state, 'completed'); assert.equal(retryResult.links[0].reason, undefined)
} finally { await rm(dir, { recursive: true, force: true }) }

let receiver: ((event: MirrorEvent) => void) | undefined
let unsubscribed = 0
let calls = 0
let runReply!: (result: any) => void
let snapshot: any = null
const model = new SiteSuckerModel({
  request: async (command) => {
    if (command === 'app-sitesucker-status') return snapshot
    if (command === 'app-sitesucker-run') { calls += 1; return new Promise((resolve) => { runReply = resolve }) }
    return null
  },
  subscribe: (callback) => { receiver = callback; return () => { unsubscribed += 1 } },
  load: async () => ({ dir: 'out' }), save: async () => { throw new Error('storage unavailable') }, id: () => 'id-1'
})
await model.init()
model.url = 'https://test.invalid/'
const run = model.run()
await new Promise((resolve) => setTimeout(resolve, 0))
assert.equal(await model.run(), false)
assert.equal(calls, 1)
receiver!({ operationId: 'old', kind: 'terminal', result: { operationId: 'old', state: 'completed', links: [], bytes: 0 } })
assert.equal(model.running, true)
const terminal = { operationId: 'id-1', state: 'partial', links: [{ url: model.url, state: 'success' }], bytes: 4 } as const
receiver!({ operationId: 'id-1', kind: 'terminal', result: terminal as any })
runReply({ operationId: 'id-1', state: 'running', links: [], bytes: 0 })
assert.equal(await run, true)
assert.equal(model.status, 'Partial', 'late start ack cannot overwrite terminal event')
assert.match(model.warning, /not saved/)
snapshot = terminal
assert.equal(await model.reconcile(), true)
assert.equal(model.links.length, 1)
model.dispose()
assert.equal(unsubscribed, 1)
const unknown = new SiteSuckerModel({ request: async (command) => { if (command === 'app-sitesucker-run') throw new SiteOutcomeUnknown('timeout'); return null }, subscribe: () => () => {}, load: async () => ({ dir: 'out' }), save: async () => {}, id: () => 'u' })
await unknown.init(); unknown.url = model.url
await unknown.run()
assert.equal(unknown.unknown, true)
assert.equal(await unknown.run(), false, 'unknown outcome blocks replay')
assert.equal(await unknown.reconcile(), true)
assert.equal(unknown.unknown, false)
let lateReceiver!: (event: MirrorEvent) => void
let rejectAck!: (error: Error) => void
const late = new SiteSuckerModel({ request: async (command) => command === 'app-sitesucker-run' ? new Promise((_resolve, reject) => { rejectAck = reject }) : null, subscribe: (callback) => { lateReceiver = callback; return () => {} }, load: async () => ({ dir: 'out' }), save: async () => {}, id: () => 'late' })
await late.init(); late.url = model.url
const lateRun = late.run(); await new Promise((resolve) => setTimeout(resolve, 0))
lateReceiver({ operationId: 'late', kind: 'terminal', result: { operationId: 'late', state: 'completed', links: [{ url: late.url, state: 'success' }], bytes: 1 } })
rejectAck(new SiteOutcomeUnknown('lost acknowledgement'))
assert.equal(await lateRun, true); assert.equal(late.status, 'Completed'); assert.equal(late.links[0].state, 'success')
let rejectStart!: (error: Error) => void
const starting = new SiteSuckerModel({ request: async (command) => command === 'app-sitesucker-run' ? new Promise((_resolve, reject) => { rejectStart = reject }) : null, subscribe: () => () => {}, load: async () => ({ dir: 'out' }), save: async () => {}, id: () => 'starting' })
await starting.init(); starting.url = model.url
const startRun = starting.run(); await new Promise((resolve) => setTimeout(resolve, 0))
await starting.cancel(); rejectStart(new Error('Mirror start was cancelled'))
await startRun; assert.equal(starting.status, 'Cancelled'); assert.equal(starting.running, false)
let loadSettings!: (value: { dir: string; maxPages: number }) => void
let releaseSave!: () => void
const stored: string[] = []
const initializing = new SiteSuckerModel({ request: async () => null, subscribe: () => () => {}, load: () => new Promise((resolve) => { loadSettings = resolve }), save: async (config) => { stored.push(config.dir); if (stored.length === 1) await new Promise<void>((resolve) => { releaseSave = resolve }) }, id: () => 'settings' })
const initial = initializing.init()
const coldSave = initializing.saveConfig()
assert.equal(initializing.settingsReady, false)
assert.equal(stored.length, 0, 'cold save must await saved settings')
loadSettings({ dir: 'saved-output', maxPages: 7 })
await initial
await new Promise((resolve) => setTimeout(resolve, 0))
initializing.config.dir = 'second-output'
const secondSave = initializing.saveConfig()
await new Promise((resolve) => setTimeout(resolve, 0))
assert.deepEqual(stored, ['saved-output'], 'writes must remain serialized')
releaseSave()
await Promise.all([coldSave, secondSave])
assert.deepEqual(stored, ['saved-output', 'second-output'])
console.log('Site Sucker behavior passed: URL/count policy, bounded streamed writes, independent results, cancellation, stale events, duplicate calls, settings initialization/order and unknown recovery.')
