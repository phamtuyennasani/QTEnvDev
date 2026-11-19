import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readLogTail } from '../src/main/core/readLogTail'
import { launchFirstEditor, windowsEditorCandidates } from '../src/fork/module/Tool/openEditor'
import { loadIsolated } from './helpers/load-isolated'

const externalEditorModule = await import('../src/fork/module/Tool/openEditor')
const launchMocks = { '../../Fn': {}, '@shared/ForkPromise': { ForkPromise: Promise } }
const unixTools = await loadIsolated('src/fork/module/Tool/terminal.ts', {
  ...launchMocks,
  '@shared/utils': { isMacOS: () => false },
  './openEditor': externalEditorModule
})
const windowsTools = await loadIsolated('src/fork/module/Tool.win/ide.ts', {
  ...launchMocks,
  '../Tool/openEditor': externalEditorModule
})
for (const [tools, file] of [[unixTools, '/fixture/config.conf'], [windowsTools, 'C:/fixture/config.conf']]) {
  await assert.rejects(tools.openPathByApp(file, 'Unsupported app'), /not supported on this platform/)
}

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
const missingFile = () => Object.assign(new Error('Fixture file is missing'), { code: 'ENOENT' })
let missingRead: string | Error = missingFile()
const writes: Array<[string, string]> = []
const launches: Array<[string, string]> = []
const notices: string[] = []
let onWrite: (() => void) | undefined
let finishRestart!: (result: true | string) => void
let restartRequests = 0
const openedVersion = {
  bin: '/fixture/apache-a/bin/httpd', version: '2.4.62', run: true, pid: '101', running: false,
  restart: () => new Promise<true | string>((resolve) => { restartRequests++; finishRestart = resolve })
}
const otherVersion = {
  bin: '/fixture/apache-b/bin/httpd', version: '2.4.62', run: true, pid: '102', running: false,
  restart: () => assert.fail('Restart must not switch to the other binary')
}
let currentVersion = openedVersion
const serviceAdapter = await loadIsolated('src/render-next/adapters/serviceAdapter.ts', {
  '@/store/brew': { BrewStore: () => ({
    module: () => ({ installed: [openedVersion, otherVersion], fetchInstalled: async () => true }),
    currentVersion: () => currentVersion
  }) },
  './lifecycleAdapter': { registerLifecycle: async () => undefined }
}, { window: { Server: { DataDirectoryReady: true } } })
let finishImport!: (result: { canceled: boolean; filePaths: string[] }) => void
let finishExport!: (result: { canceled: boolean; filePath?: string }) => void
let finishLaunch!: (result: string | true) => void
const { ServiceFilesController } = await loadIsolated('src/render-next/state/serviceFilesController.ts', {
  '@/util/IPC': {
    send: (_channel: string, method: string) => {
      assert.equal(method, 'listConfigFiles')
      const key = 'configuration-list'
      return {
        key,
        then: (reply: (key: string, value: unknown) => void) =>
          reply(key, { code: 0, data: [{ name: 'Main config', path: '/second', exists: true }] })
      }
    },
    off: () => undefined
  },
  '@/util/NodeFn': {
    dialog: {
      showOpenDialog: () => new Promise((resolve) => { finishImport = resolve }),
      showSaveDialog: () => new Promise((resolve) => { finishExport = resolve })
    },
    fs: {
      realpath: async (file: string) => file === '/alias' ? '/second' : file,
      stat: async (file: string) => ({ size: file === '/oversize' ? 5 * 1024 * 1024 + 1 : 120, isFile: file !== '/directory' }),
      existsSync: async (file: string) => file !== '/missing',
      readFileStrict: async (file: string) => {
        if (file === '/default') return 'default configuration'
        if (file === '/import') return 'imported configuration'
        if (file === '/first') return first
        if (file === '/denied') {
          throw Object.assign(new Error('Fixture access denied'), { code: 'EACCES' })
        }
        if (file === '/missing') {
          if (missingRead instanceof Error) throw missingRead
          return missingRead
        }
        return contents
      },
      writeFile: async (file: string, data: string) => { writes.push([file, data]); contents = data; onWrite?.() }
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
  '../adapters/serviceAdapter': serviceAdapter,
  './app': { showNotice: (message: string) => notices.push(message) }
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

await editor.select({ name: 'No access', path: '/denied', kind: 'config' })
assert.equal(editor.canRestore, false)
assert.match(editor.error, /Fixture access denied/)
await editor.select({ name: 'Read only', path: '/missing', kind: 'config', readOnly: true })
assert.equal(editor.canRestore, false)

const missing = { name: 'Missing vhost', path: '/missing', kind: 'config' as const }
await editor.select(missing)
assert.equal(editor.canRestore, true)
assert.equal(editor.canSave, false)
assert.equal(
  await editor.restoreSelected(async () => { throw new Error('Result unknown. Refresh.') }),
  false
)
assert.equal(editor.canRestore, false, 'a new strict read must precede a retry')
await editor.readSelected()
assert.equal(editor.canRestore, true)

let finishRestore!: () => void
const pendingRestore = editor.restoreSelected((file: { path: string }) => {
  assert.equal(file.path, missing.path)
  return new Promise((resolve) => {
    finishRestore = () => {
      missingRead = 'recreated vhost'
      resolve('created')
    }
  })
})
assert.equal(editor.restoring, true)
assert.equal(await editor.restoreSelected(() => assert.fail('duplicate restore reached the callback')), false)
await editor.select({ name: 'Another vhost', path: '/second', kind: 'config' })
finishRestore()
assert.equal(await pendingRestore, true)
assert.equal(editor.content, 'saved')
assert.equal(editor.warning, '')
assert.equal(editor.restoring, false)

missingRead = missingFile()
await editor.select(missing)
assert.equal(await editor.restoreSelected(async () => {
  missingRead = Object.assign(new Error('Preview denied'), { code: 'EACCES' })
  return 'created'
}), true)
assert.equal(editor.warning, 'Configuration created.')
assert.match(editor.error, /Preview denied/)

missingRead = missingFile()
await editor.select(missing)
const closing = editor.restoreSelected(() => new Promise((resolve) => {
  finishRestore = () => resolve('exists')
}))
editor.clear()
finishRestore()
assert.equal(await closing, true)
assert.equal(editor.selected, undefined)
assert.equal(editor.warning, '')
assert.equal(editor.restoring, false)
const configuration = { path: '/second', name: 'Main config', kind: 'config' as const, defaultPath: '/default' }
await editor.openProvided(async () => [configuration])
await editor.transferConfiguration('default')
assert.equal(editor.content, 'default configuration')
assert.equal(editor.canSave, true)
assert.deepEqual(writes, [['/second', 'saved']])

const importFile = editor.transferConfiguration('import')
assert.equal(await editor.transferConfiguration('default'), false)
finishImport({ canceled: false, filePaths: ['/import'] })
assert.equal(await importFile, true)
assert.equal(editor.content, 'imported configuration')

for (const [path, expected] of [['/oversize', /limited to 5 MiB/], ['/denied', /Fixture access denied/]] as const) {
  const failed = editor.transferConfiguration('import')
  finishImport({ canceled: false, filePaths: [path] })
  assert.equal(await failed, false)
  assert.match(editor.error, expected)
  assert.equal(editor.content, 'imported configuration')
}
const canceled = editor.transferConfiguration('import')
finishImport({ canceled: true, filePaths: [] })
assert.equal(await canceled, false)
assert.equal(editor.content, 'imported configuration')

const alias = editor.transferConfiguration('export')
finishExport({ canceled: false, filePath: '/alias' })
assert.equal(await alias, false)
assert.match(editor.error, /separate path/)
assert.equal(writes.length, 1)

const exportCopy = editor.transferConfiguration('export')
editor.clear()
finishExport({ canceled: false, filePath: '/export' })
assert.equal(await exportCopy, true)
assert.deepEqual(writes.at(-1), ['/export', 'imported configuration'])
assert.deepEqual(notices, ['Configuration copy saved.'])

await editor.openProvided(async () => [configuration])
const staleImport = editor.transferConfiguration('import')
await editor.select({ name: 'Different config', path: '/different', kind: 'config' })
finishImport({ canceled: false, filePaths: ['/import'] })
assert.equal(await staleImport, false)
assert.equal(editor.content, contents)

const openRestartConfig = () => editor.open('Apache', openedVersion, 'config', undefined, async (version: { bin: string }) => {
  assert.equal(version.bin, openedVersion.bin)
  return [configuration]
})
await editor.open('Apache', '2.4.62', 'config')
assert.equal(editor.canRestart, false, 'a version string cannot distinguish two running binaries')
otherVersion.run = false
await editor.open('Apache', '2.4.62', 'config')
assert.equal(editor.canRestart, true, 'a distinct running version comes from the same binary as the listed configuration')
otherVersion.run = true
await openRestartConfig()
assert.equal(editor.canRestart, true)
currentVersion = otherVersion
editor.content = 'saved without restart'
assert.equal(await editor.save(), true)
assert.equal(restartRequests, 0)

editor.content = 'saved before restart failed'
const restart = editor.saveAndRestart()
assert.equal(await editor.saveAndRestart(), false)
await new Promise((resolve) => setImmediate(resolve))
assert.equal(restartRequests, 1)
assert.equal(editor.restarting, true)
assert.equal(contents, 'saved before restart failed')
assert.equal(editor.warning, 'Configuration saved.')
finishRestart('The process failed to start.')
assert.equal(await restart, true)
assert.match(editor.warning, /Configuration saved.*Restart failed.*failed to start/)
assert.equal(editor.canSave, false)

openedVersion.running = true
assert.equal(editor.canRestart, false)
openedVersion.running = false
openedVersion.pid = ''
assert.equal(editor.canRestart, false)
openedVersion.pid = '101'
editor.content = 'saved after target stopped'
onWrite = () => { openedVersion.run = false }
assert.equal(await editor.saveAndRestart(), true)
onWrite = undefined
assert.equal(restartRequests, 1)
assert.equal(editor.canRestart, false)
assert.match(editor.warning, /Configuration saved.*no longer running/)

openedVersion.run = true
editor.content = 'saved before closing'
const restartAfterClose = editor.saveAndRestart()
await new Promise((resolve) => setImmediate(resolve))
assert.equal(restartRequests, 2)
editor.clear()
await openRestartConfig()
assert.equal(editor.restarting, true)
finishRestart(true)
assert.equal(await restartAfterClose, true)
assert.equal(editor.restarting, false)
assert.equal(editor.content, 'saved before closing')
assert.equal(notices.at(-1), 'Configuration saved. Apache restarted.')
console.log('Service files passed: bounded native tail, external editor lifecycle, edit conflicts, missing configuration restoration, and save with restart.')
