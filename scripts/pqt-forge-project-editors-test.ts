import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { promisify } from 'node:util'
import { loadIsolated } from './helpers/load-isolated'

type Launch = [executable: string, args: string[]]
const launches: Launch[] = []
const macOpens: Launch[] = []
const spawn = (file: string, args: string[], options: { shell?: boolean; detached?: boolean }) => {
  launches.push([file, Array.from(args)])
  assert.equal(options.shell, undefined)
  assert.equal(options.detached, true)
  const child = Object.assign(new EventEmitter(), { unref() {} })
  queueMicrotask(() => {
    if (file === 'pycharm' || file === 'pycharm-professional' || file.includes('\\251.9\\')) {
      child.emit(
        'error',
        Object.assign(new Error('Missing editor candidate'), {
          code: file === 'pycharm-professional' ? 'EACCES' : 'ENOENT'
        })
      )
    } else {
      child.emit('spawn')
    }
  })
  return child
}
const execFile = (file: string, args: string[], callback: (error?: Error) => void) => {
  macOpens.push([file, Array.from(args)])
  queueMicrotask(() =>
    callback(args[1] === 'PyCharm' ? new Error('Missing PyCharm app') : undefined)
  )
}
const editors = await loadIsolated('src/fork/module/Tool/openEditor.ts', {
  'node:child_process': { spawn, execFile }
})
const project = '/fixture/a project & assorted files'
for (const name of ['PyCharm', 'GoLand']) {
  assert.equal(editors.isExternalEditor(name), true)
  assert.equal(await editors.openUnixEditor(project, name, false), true)
  assert.equal(await editors.openUnixEditor(project, name, true), true)
  await assert.rejects(
    editors.openUnixEditor('relative/project', name, false),
    /absolute file path/
  )
}
assert.deepEqual(launches.splice(0), [
  ['pycharm', [project]],
  ['pycharm-professional', [project]],
  ['pycharm-community', [project]],
  ['goland', [project]]
])
assert.deepEqual(macOpens, [
  ['/usr/bin/open', ['-a', 'PyCharm', project]],
  ['/usr/bin/open', ['-a', 'PyCharm CE', project]],
  ['/usr/bin/open', ['-a', 'GoLand', project]]
])

const systemRegistry = 'C:\\Windows\\System32\\reg.exe'
const registered = 'C:\\Program Files\\JetBrains\\PyCharm 2025'
const toolbox = 'D:\\Toolbox & downloads'
const registryQueries: Launch[] = []
const enumerations: string[] = []
const query = Object.assign(() => {}, {
  [promisify.custom]: async (file: string, args: string[]) => {
    registryQueries.push([file, Array.from(args)])
    if (args[1] === 'HKLM\\SOFTWARE\\JetBrains\\PyCharm') {
      return { stdout: '    InstallPath    REG_SZ    ' + registered }
    }
    if (args[1] === 'HKCU\\SOFTWARE\\JetBrains\\Toolbox') {
      return { stdout: '    InstallDir    REG_SZ    ' + toolbox }
    }
    throw new Error('Missing registry key')
  }
})
const windows = await loadIsolated(
  'src/fork/module/Tool.win/ide.ts',
  {
    '../../Fn': {
      execPromiseWithEnv() {
        throw new Error('Unexpected shell command')
      }
    },
    '@shared/ForkPromise': { ForkPromise: Promise },
    '@shared/WindowsSystemPaths': {
      resolveWindowsSystemExecutable(name: string) {
        assert.equal(name, 'reg.exe')
        return systemRegistry
      }
    },
    'node:child_process': { execFile: query },
    'node:fs/promises': {
      async readdir(path: string, options: { withFileTypes: boolean }) {
        enumerations.push(path)
        assert.equal(options.withFileTypes, true)
        return [
          { name: '251.8', isDirectory: () => true },
          { name: '251.9', isDirectory: () => true },
          { name: '252.0', isDirectory: () => false }
        ]
      }
    },
    '../Tool/openEditor': editors
  },
  { process: { env: {} } }
)
const windowsProject = 'C:\\Projects & code\\a project'
for (const name of ['PyCharm', 'GoLand']) {
  const scans = registryQueries.length
  await assert.rejects(windows.openPathByApp('folder\\child', name), /absolute file path/)
  await assert.rejects(windows.openPathByApp('\\drive-relative', name), /absolute file path/)
  assert.equal(registryQueries.length, scans)
  assert.equal(await windows.openPathByApp(windowsProject, name), true)
}
assert.ok(registryQueries.every(([file, args]) => file === systemRegistry && args[0] === 'query'))
assert.deepEqual(enumerations, [toolbox + '\\apps\\GoLand\\ch-0'])
assert.deepEqual(launches, [
  [registered + '\\bin\\pycharm64.exe', [windowsProject]],
  [toolbox + '\\apps\\GoLand\\ch-0\\251.9\\bin\\goland64.exe', [windowsProject]],
  [toolbox + '\\apps\\GoLand\\ch-0\\251.8\\bin\\goland64.exe', [windowsProject]]
])
console.log('Project editor launch routes passed: PyCharm and GoLand on Windows, macOS and Linux.')
