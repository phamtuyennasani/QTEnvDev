import assert from 'node:assert/strict'
import { ImageBatchOperation } from '../src/render/components/Tools/ImageCompress/ImageBatchOperation'
import { snapshotImageConfig } from '../src/render/components/Tools/ImageCompress/ImagePipelineConfig'

const config = { format: 'webp' as const, width: 640, timeoutSeconds: 30, webp: { quality: 82 }, watermark: { enabled: true, type: 'text' as const, content: { text: 'Project', opacity: .6 } }, texture: { enabled: true, type: 'grid' as const, opacity: .2 } }
const snapshot = snapshotImageConfig(config)
config.webp.quality = 20
assert.equal(snapshot.webp?.quality, 82)
assert.equal((snapshot.watermark?.content as { text: string }).text, 'Project')
assert.throws(() => snapshotImageConfig({ width: NaN }), /finite/)
assert.throws(() => snapshotImageConfig({ webp: { quality: 101 } }), /between/)
assert.throws(() => snapshotImageConfig({ format: 'exe' }), /unsupported/)
assert.throws(() => snapshotImageConfig({ watermark: { enabled: true, type: 'image', content: {} } }), /image is required/)

const callbacks = new Map<string, (key: string, reply: any) => void>()
const calls: { method: string; args: unknown[]; key: string }[] = []
const removed: string[] = []; const notices: string[] = []
let timeout: (() => void) | undefined
const controller = new ImageBatchOperation({
  ipc: {
    send(_command, method, ...args) { const key = 'image-' + calls.length; calls.push({ method: String(method), args, key }); return { key, then(callback) { callbacks.set(key, callback) } } },
    off(key) { removed.push(key); callbacks.delete(key) }
  },
  config: () => config, notice: (message) => notices.push(message),
  observe(callback) { timeout = callback; return 1 as unknown as ReturnType<typeof setTimeout> },
  stopObserving() {}
})
const respond = (key: string, reply: any) => callbacks.get(key)!(key, reply)
assert.equal(controller.imageSelected(['good.png', 'bad.png', 'other.png']), true)
assert.equal(controller.imageSelected(['duplicate.png']), false)
assert.equal(controller.clear(), false)
const discover = calls[0].key
respond(discover, { code: 200, msg: { allFile: [{ path: 'good.png' }, { path: 'bad.png' }, { path: 'other.png' }] } })
respond(discover, { code: 200, msg: { successTask: [{ path: 'good.png', width: 1000, height: 500, ext: 'png' }, { path: 'other.png', width: 1000, height: 500, ext: 'png' }], failTask: [{ path: 'bad.png', hasError: true, errorMessage: 'Unreadable' }] } })
assert.equal(controller.fetching, true)
respond(discover, { code: 0 })
assert.equal(controller.fetching, false)
assert(removed.includes(discover))
assert.equal(controller.doProcess(), false, 'required output directory must be selected')
controller.saveDir = 'C:/output'
assert.equal(controller.doProcess(), true)
assert.equal(controller.doProcess(), false)
assert.equal(controller.clear(), false)
assert.equal(controller.remove('good.png'), false)
const compress = calls[1]
assert.equal((compress.args[0] as any[]).length, 2)
assert.equal(controller.outcomes['bad.png'], 'skipped')
config.width = 320
assert.equal((compress.args[1] as any).width, 640, 'dispatch uses an immutable option snapshot')
respond(compress.key, { code: 200, msg: { successTask: [{ image: { path: 'good.png' }, hasError: false, sizeFormatted: '3 KB' }], failTask: [{ image: { path: 'other.png' }, hasError: true, errorMessage: 'Cannot write' }] } })
assert.equal(controller.processing, true)
assert.equal(controller.outcomes['good.png'], 'completed')
assert.equal(controller.outcomes['other.png'], 'failed')
respond(compress.key, { code: 0 })
assert.equal(controller.status, 'Partially completed')
assert.equal(controller.processing, false)
assert.equal(controller.images[0].result?.sizeFormatted, '3 KB', 'completed file results survive sibling failure')
assert(removed.includes(compress.key))
assert.equal(controller.doProcess(), true)
const late = calls[2].key
timeout!()
assert.equal(controller.unknown, true)
assert.equal(controller.doProcess(), false, 'unknown work cannot be replayed')
assert(callbacks.has(late), 'unknown request retains its listener for a late terminal result')
respond(late, { code: 200, msg: { successTask: [{ image: { path: 'good.png' }, hasError: false }, { image: { path: 'other.png' }, hasError: false }], failTask: [] } })
respond(late, { code: 0 })
assert.equal(controller.unknown, false)
assert.equal(controller.status, 'Completed')
assert.equal(controller.clear(), true)
console.log('PQT Forge image pipeline passed: full option snapshots, validation, duplicate/queue guard, discovery failure, partial completion, timeout and late terminal cleanup.')
