import { execPromiseWithEnv } from '../../Fn'
import { ForkPromise } from '@shared/ForkPromise'
import { resolveWindowsSystemExecutable } from '@shared/WindowsSystemPaths'
import { execFile } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { win32 } from 'node:path'
import { promisify } from 'node:util'
import { launchFirstEditor, windowsEditorCandidates } from '../Tool/openEditor'

const execFileAsync = promisify(execFile)
const fullWindowsPath = (path: string) =>
  win32.isAbsolute(path) && win32.parse(path).root.length > 1

async function registryQuery(key: string, args: string[]) {
  try {
    const { stdout } = await execFileAsync(
      resolveWindowsSystemExecutable('reg.exe'),
      ['query', key, ...args],
      { windowsHide: true, timeout: 8_000 }
    )
    return stdout
  } catch {
    // The key may be absent or unreadable. Other installation locations still apply.
    return ''
  }
}

function* registryPaths(stdout: string, valuePattern: RegExp) {
  for (const line of stdout.split(/\r?\n/)) {
    const path = line
      .trim()
      .match(valuePattern)?.[1]
      ?.trim()
      .replace(/^"(.*)"$/, '$1')
    if (path && fullWindowsPath(path)) yield path
  }
}

async function* jetBrainsEditorCandidates(ideName: string) {
  const registryKeys = [
    `HKLM\\SOFTWARE\\JetBrains\\${ideName}`,
    `HKLM\\SOFTWARE\\WOW6432Node\\JetBrains\\${ideName}`,
    `HKCU\\SOFTWARE\\JetBrains\\${ideName}`
  ]
  for (const key of registryKeys) {
    const stdout = await registryQuery(key, ['/s'])
    for (const path of registryPaths(stdout, /^(?:InstallPath|\(Default\))\s+REG_SZ\s+(.+)$/i)) {
      yield formatExePath(path, ideName)
    }
  }

  if (ideName === 'PyCharm' || ideName === 'GoLand') {
    const local = process.env.LOCALAPPDATA
    if (local && fullWindowsPath(local)) {
      const names = ideName === 'PyCharm' ? ['PyCharm', 'PyCharm Community Edition'] : ['GoLand']
      for (const name of names) yield formatExePath(win32.join(local, 'Programs', name), ideName)
    }
  }

  const stdout = await registryQuery('HKCU\\SOFTWARE\\JetBrains\\Toolbox', ['/v', 'InstallDir'])
  for (const path of registryPaths(stdout, /^InstallDir\s+REG_SZ\s+(.+)$/i)) {
    const names = ideName === 'PyCharm' ? ['PyCharm', 'PyCharm-P', 'PyCharm-C'] : [ideName]
    for (const name of names) {
      const appsPath = win32.join(path, 'apps', name, 'ch-0')
      let versions
      try {
        versions = await readdir(appsPath, { withFileTypes: true })
      } catch {
        continue
      }
      const dirs = versions.filter((entry) => entry.isDirectory()).map(({ name }) => name)
      for (const version of dirs.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))) {
        yield formatExePath(win32.join(appsPath, version), ideName)
      }
    }
  }
}

// 统一格式化可执行文件路径
const formatExePath = (basePath: string, ideName: string) => {
  const exeMap: Record<string, string> = {
    phpstorm: 'phpstorm64.exe',
    pycharm: 'pycharm64.exe',
    intellijidea: 'idea64.exe',
    webstorm: 'webstorm64.exe',
    clion: 'clion64.exe',
    rider: 'rider64.exe',
    goland: 'goland64.exe',
    datagrip: 'datagrip64.exe',
    rubymine: 'rubymine64.exe',
    appcode: 'appcode64.exe'
  }

  const normalizedName = ideName.toLowerCase()
  const exeName = exeMap[normalizedName] || `${normalizedName}64.exe`
  return win32.join(basePath, 'bin', exeName)
}

const openWithIde = async (ideName: string, folderPath: string) => {
  try {
    if (!(await launchFirstEditor(jetBrainsEditorCandidates(ideName), folderPath))) {
      console.error(`${ideName} not found`)
      return false
    }

    console.log(`Opened ${folderPath} with ${ideName}`)
    return true
  } catch (error) {
    console.error(`Error opening IDE: ${error}`)
    return false
  }
}

const getHBuilderXPath = async (): Promise<string | null> => {
  try {
    // 查询注册表
    const { stdout } = await execPromiseWithEnv(
      `reg query "HKCR\\hbuilderx\\shell\\open\\command" /ve`
    )

    // 提取路径（示例输出: "(Default) REG_SZ "D:\Program Files\HBuilderX\HBuilderX.exe" "%1""）
    const match = stdout.match(/"(.*?HBuilderX\.exe)"/i)
    if (match && match[1]) {
      return match[1] // 返回可执行文件完整路径
    }
    return null
  } catch {
    return null
  }
}

const openWithHBuilderX = async (targetPath: string): Promise<boolean> => {
  try {
    const hbuilderxPath = await getHBuilderXPath()
    if (!hbuilderxPath) {
      return false
    }
    await execPromiseWithEnv(`"${hbuilderxPath}" "${targetPath}"`)
    return true
  } catch {
    return false
  }
}

export function openPathByApp(
  dir: string,
  app:
    | 'PowerShell'
    | 'PowerShell7'
    | 'VSCode'
    | 'Sublime'
    | 'PhpStorm'
    | 'WebStorm'
    | 'IntelliJ'
    | 'PyCharm'
    | 'RubyMine'
    | 'GoLand'
    | 'HBuilderX'
    | 'RustRover'
) {
  return new ForkPromise(async (resolve, reject) => {
    if (app === 'VSCode' || app === 'Sublime') {
      try {
        if (!win32.isAbsolute(dir)) throw new Error('An absolute file path is required.')
        if (await launchFirstEditor(windowsEditorCandidates(app), dir)) {
          resolve(true)
        } else {
          reject(
            new Error(`${app === 'VSCode' ? 'Visual Studio Code' : 'Sublime Text'} was not found.`)
          )
        }
      } catch (error) {
        reject(error)
      }
      return
    }
    let command = ''
    const JetBrains = [
      'PhpStorm',
      'WebStorm',
      'IntelliJ',
      'PyCharm',
      'RubyMine',
      'GoLand',
      'RustRover'
    ]
    if (JetBrains.includes(app)) {
      if ((app === 'PyCharm' || app === 'GoLand') && !fullWindowsPath(dir)) {
        return reject(new Error('An absolute file path is required.'))
      }
      const res = await openWithIde(app, dir)
      if (res) {
        return resolve(true)
      }
      return reject(new Error(`${app} Not Found`))
    }
    if (app === 'HBuilderX') {
      const res = await openWithHBuilderX(dir)
      if (res) {
        return resolve(true)
      }
      return reject(new Error(`HBuilderX Not Found`))
    }
    if (app === 'PowerShell') {
      command = `cd "${dir}"`
      command = JSON.stringify(command).slice(1, -1)
      command = `start powershell -NoExit -Command "${command}"`
    } else if (app === 'PowerShell7') {
      command = `cd "${dir}"`
      command = JSON.stringify(command).slice(1, -1)
      command = `start pwsh.exe -NoExit -Command "${command}"`
    } else {
      reject(new Error('This application is not supported on this platform.'))
      return
    }
    try {
      await execPromiseWithEnv(command)
    } catch (e) {
      return reject(e)
    }
    resolve(true)
  })
}
