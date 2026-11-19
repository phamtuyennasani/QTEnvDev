import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readLogTail } from '../src/main/core/readLogTail'
import { launchFirstEditor, windowsEditorCandidates } from '../src/fork/module/Tool/openEditor'
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

  // A temporary Node program stands in for a desktop editor. The launcher
  // must pass the complete path as one argument, even with spaces and &.
  const marker = join(root, 'editor-received.txt')
  const fixture = join(root, 'config & editor fixture.cjs')
  await writeFile(fixture, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, __filename)`)
  const missing = join(root, 'missing-executable.exe')
  assert.equal(await launchFirstEditor([missing], fixture), false)
  assert.equal(await launchFirstEditor([missing, process.execPath], fixture), true)
  let received = ''
  for (let attempt = 0; attempt < 200; attempt++) {
    received = await readFile(marker, 'utf-8').catch(() => '')
    if (received) break
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.equal(received, fixture)
  assert.ok(windowsEditorCandidates('VSCode', { LOCALAPPDATA: 'C:\\Users\\Fixture\\AppData\\Local' })
    .includes('C:\\Users\\Fixture\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe'))
  assert.ok(windowsEditorCandidates('Sublime', { ProgramFiles: 'C:\\Program Files' })
    .includes('C:\\Program Files\\Sublime Text\\sublime_text.exe'))
} finally {
  await rm(root, { recursive: true, force: true })
}

let finishFirst!: (value: string) => void
const first = new Promise<string>((resolve) => { finishFirst = resolve })
let contents = 'original'
const writes: Array<[string, string]> = []
const launches: Array<[string, string]> = []
let finishLaunch!: (result: string | true) => void
const { ServiceFilesController } = await loadIsolated('src/render-next/state/serviceFilesController.ts', {
  '@/util/IPC': {},
  '@/util/NodeFn': {
    fs: {
      existsSync: async (file: string) => file !== '/missing',
      readFileStrict: async (file: string) => file === '/first' ? first : contents,
      writeFile: async (file: string, data: string) => { writes.push([file, data]); contents = data }
    },
    shell: {}
  },
  '@/util/Project': { Project: {
    openPath: (file: string, editorName: string) => {
      launches.push([file, editorName])
      return new Promise((resolve) => { finishLaunch = resolve })
    }
  } },
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

await editor.select({ name: 'Missing', path: '/missing', kind: 'config' })
assert.equal(await editor.openExternal(editor.selected, 'VSCode'), false)
assert.match(editor.error, /configuration file was not found/i)
assert.deepEqual(launches, [])
await editor.select({ name: 'Generated configuration', path: '/second', kind: 'config' })
const pendingLaunch = editor.openExternal(editor.selected, 'PhpStorm')
assert.equal(await editor.openExternal(editor.selected, 'WebStorm'), false)
assert.deepEqual(launches, [['/second', 'PhpStorm']])
editor.clear()
await editor.select({ name: 'Reopened', path: '/third', kind: 'config' })
finishLaunch('Editor not installed')
assert.equal(await pendingLaunch, false)
assert.equal(editor.error, '')
assert.equal(editor.openingExternal, false)
console.log('Service files passed: bounded native tail, external editor argument and lifecycle, stale read, external edit protection, committed write warning and closed dialog.')
