import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readLogTail } from '../src/main/core/readLogTail'
import { loadIsolated } from './helpers/load-isolated'

const root = await mkdtemp(join(tmpdir(), 'pqt-service-files-'))
try {
  const path = join(root, 'service.log')
  await writeFile(path, 'discarded\n' + 'o'.repeat(199_996) + '\nend')
  const tail = await readLogTail(path)
  assert.equal(Buffer.byteLength(tail), 200_000)
  assert(!tail.includes('discarded'))
  assert(tail.endsWith('\nend'))
  await assert.rejects(readLogTail(root), /regular file/)
} finally {
  await rm(root, { recursive: true, force: true })
}

let finishFirst!: (value: string) => void
const first = new Promise<string>((resolve) => { finishFirst = resolve })
let contents = 'original'
const writes: Array<[string, string]> = []
const { ServiceFilesController } = await loadIsolated('src/render-next/state/serviceFilesController.ts', {
  '@/util/IPC': {},
  '@/util/NodeFn': {
    fs: {
      readFileStrict: async (file: string) => file === '/first' ? first : contents,
      writeFile: async (file: string, data: string) => { writes.push([file, data]); contents = data }
    },
    shell: {}
  },
  '../packages/types': { packageError: String },
  '../adapters/serviceAdapter': {}
})
const editor = new ServiceFilesController()
const read = editor.select({ name: 'Old', path: '/first', kind: 'config' })
await editor.select({ name: 'New', path: '/second', kind: 'config' })
finishFirst('stale')
await read
assert.equal(editor.content, 'original')

editor.content = 'proposed'
contents = 'edited externally'
assert.equal(await editor.save(), false)
assert.match(editor.error, /changed outside/)
assert.deepEqual(writes, [])
await editor.readSelected()
editor.content = 'saved'
assert.equal(await editor.save(async () => { throw new Error('restart failed') }), true)
assert.deepEqual(writes, [['/second', 'saved']])
assert.match(editor.warning, /Configuration saved.*restart failed/)

let finishList!: (value: unknown[]) => void
const listing = editor.openProvided(() => new Promise((resolve) => { finishList = resolve }))
editor.clear()
finishList([{ name: 'Late', path: '/second', kind: 'config' }])
await listing
assert.equal(editor.selected, undefined)
assert.equal(editor.content, '')
console.log('Service files passed: bounded native tail, stale read, external edit protection, committed write warning and closed dialog.')
