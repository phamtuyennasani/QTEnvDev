import { execFile, spawn } from 'node:child_process'
import { isAbsolute, win32 } from 'node:path'

const editors = {
  VSCode: { macOS: ['Visual Studio Code'], linux: ['code'] },
  PhpStorm: { macOS: ['PhpStorm'], linux: ['phpstorm'] },
  WebStorm: { macOS: ['WebStorm'], linux: ['webstorm'] },
  Sublime: { macOS: ['Sublime Text'], linux: ['subl', 'sublime_text'] },
  PyCharm: {
    macOS: ['PyCharm', 'PyCharm CE'],
    linux: ['pycharm', 'pycharm-professional', 'pycharm-community']
  },
  GoLand: { macOS: ['GoLand'], linux: ['goland'] }
}

export type ExternalEditor = keyof typeof editors

export function isExternalEditor(value: string): value is ExternalEditor {
  return Object.hasOwn(editors, value)
}

export function launchEditor(executable: string, path: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(executable, [path], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

export async function launchFirstEditor(
  candidates: Iterable<string> | AsyncIterable<string>,
  path: string
) {
  for await (const executable of candidates) {
    try {
      await launchEditor(executable, path)
      return true
    } catch (error) {
      if (!['ENOENT', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error
    }
  }
  return false
}

export async function openUnixEditor(path: string, editor: ExternalEditor, macOS: boolean) {
  if (!isAbsolute(path)) throw new Error('An absolute file path is required.')
  const selected = editors[editor]
  if (macOS) {
    for (const app of selected.macOS) {
      const opened = await new Promise<boolean>((resolve) => {
        execFile('/usr/bin/open', ['-a', app, path], (error) => resolve(!error))
      })
      if (opened) return true
    }
    throw new Error(`${selected.macOS[0]} could not open the file.`)
  }
  if (await launchFirstEditor(selected.linux, path)) return true
  throw new Error(`${selected.macOS[0]} was not found on PATH.`)
}

export function windowsEditorCandidates(editor: 'VSCode' | 'Sublime', env = process.env) {
  const roots = [
    env.LOCALAPPDATA && win32.join(env.LOCALAPPDATA, 'Programs'),
    env.ProgramFiles,
    env['ProgramFiles(x86)']
  ].filter((root): root is string => Boolean(root))
  const installs =
    editor === 'VSCode'
      ? ['Microsoft VS Code\\Code.exe']
      : [
          'Sublime Text\\subl.exe',
          'Sublime Text\\sublime_text.exe',
          'Sublime Text 3\\sublime_text.exe'
        ]
  return [
    ...roots.flatMap((root) => installs.map((install) => win32.join(root, install))),
    ...(editor === 'VSCode' ? ['Code.exe'] : ['subl.exe', 'sublime_text.exe'])
  ]
}
