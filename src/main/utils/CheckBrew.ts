import { isArmArch, isLinux, isMacOS } from '@shared/utils'
import { userInfo } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { spawnPromiseWithEnv } from '@shared/child-process'

/**
 * 检查 macOS Brew
 */
const checkMacOSBrew = (sendGlobalUpdate: () => void) => {
  const brewBin = isArmArch() ? '/opt/homebrew/bin/brew' : '/usr/local/Homebrew/bin/brew'
  return runBrewChecks([brewBin], sendGlobalUpdate)
}

/**
 * 检查 Linux Brew
 */
const checkLinuxBrew = (sendGlobalUpdate: () => void) => {
  const uinfo = userInfo()
  const brewBins = [
    join(uinfo.homedir, '.linuxbrew/bin/brew'),
    '/home/linuxbrew/.linuxbrew/bin/brew'
  ]
  runBrewChecks(brewBins, sendGlobalUpdate)
}

const KNOWN_BREW_PATHS = [
  '/opt/homebrew/bin/brew',
  '/usr/local/bin/brew',
  '/usr/local/Homebrew/bin/brew'
]

/**
 * 运行 Brew 检查
 */
const runBrewChecks = (brewBins: string[], sendGlobalUpdate: () => void) => {
  const handleBrewCheck = (error?: Error) => {
    if (error) {
      global.Server.BrewError = error.toString()
    }
    sendGlobalUpdate()
  }

  return executeBrewChecks(brewBins, handleBrewCheck)
}

/**
 * 执行 Brew 检查命令
 */
const executeBrewChecks = async (brewBins: string[], handleBrewCheck: (error?: Error) => void) => {
  try {
    const known = [global.Server.BrewBin, ...brewBins, ...(isMacOS() ? KNOWN_BREW_PATHS : [])]
    const bin = known.find((path): path is string => Boolean(path && existsSync(path))) ??
      (await spawnPromiseWithEnv('which', ['brew'], { shell: false, timeout: 30_000 })).stdout.trim()
    if (!bin || !existsSync(bin)) throw new Error('Homebrew executable was not found')
    if (global.Server.BrewBin !== bin) {
      delete global.Server.BrewHome
      delete global.Server.BrewCellar
    }
    global.Server.BrewBin = bin
    void checkBrewRepo(bin, handleBrewCheck)
    return await checkBrewCellar(bin, handleBrewCheck)
  } catch (error) {
    delete global.Server.BrewBin
    delete global.Server.BrewHome
    delete global.Server.BrewCellar
    handleBrewCheck(error instanceof Error ? error : new Error(String(error)))
    return undefined
  }
}

/**
 * 检查 Brew 仓库
 */
const checkBrewRepo = (bin: string, handleBrewCheck: (error?: Error) => void) => {
  spawnPromiseWithEnv(bin, ['--repo'], { shell: false, timeout: 30_000 })
    .then((res) => {
      if (global.Server.BrewBin !== bin) return
      console.log('brew --repo: ', res)
      const dir = res.stdout
      global.Server.BrewHome = dir
      handleBrewCheck()
      void makeRepoSafe(dir).catch((error) => console.log('brew repo setup err: ', error))
    })
    .catch((e: Error) => {
      if (global.Server.BrewBin !== bin) return
      delete global.Server.BrewHome
      handleBrewCheck()
      console.log('brew --repo err: ', e)
    })
}

/**
 * 检查 Brew Cellar
 */
const checkBrewCellar = async (bin: string, handleBrewCheck: (error?: Error) => void) => {
  try {
    const { stdout } = await spawnPromiseWithEnv(bin, ['--cellar'], { shell: false, timeout: 30_000 })
    if (global.Server.BrewBin !== bin) return
    const dir = stdout.trim()
    if (!dir) throw new Error('Homebrew did not return its Cellar directory')
    global.Server.BrewCellar = dir
    delete global.Server.BrewError
    handleBrewCheck()
    return { bin, cellar: dir }
  } catch (error) {
    if (global.Server.BrewBin !== bin) return
    delete global.Server.BrewCellar
    handleBrewCheck(error instanceof Error ? error : new Error(String(error)))
    return undefined
  }
}

export const refreshMacOSHomebrew = async () => {
  if (!isMacOS()) throw new Error('Homebrew installation requires macOS')
  const detected = await checkMacOSBrew(() => {})
  if (!detected) throw new Error(global.Server.BrewError || 'Homebrew could not be detected')
  return detected
}

/**
 * 设置 Git 安全目录
 */
const makeRepoSafe = (dir: string) => {
  return spawnPromiseWithEnv('git', [
    'config',
    '--global',
    '--add',
    'safe.directory',
    join(dir, 'Library/Taps/homebrew/homebrew-core')
  ]).then(() => {
    return spawnPromiseWithEnv('git', [
      'config',
      '--global',
      '--add',
      'safe.directory',
      join(dir, 'Library/Taps/homebrew/homebrew-cask')
    ])
  })
}

/**
 * 检查 MacPorts
 */
const checkMacPorts = (sendGlobalUpdate: () => void) => {
  spawnPromiseWithEnv('which', ['port'])
    .then((res) => {
      global.Server.MacPorts = res.stdout
      sendGlobalUpdate()
    })
    .catch((e: Error) => {
      console.log('which port e: ', e)
    })
}

/**
 * 检查 SDKMAN
 */
const checkSdkman = (sendGlobalUpdate: () => void) => {
  const uinfo = userInfo()
  const sdkmanInit = join(uinfo.homedir, '.sdkman/bin/sdkman-init.sh')
  if (existsSync(sdkmanInit)) {
    global.Server.SdkmanHome = join(uinfo.homedir, '.sdkman')
    sendGlobalUpdate()
  }
}

/**
 * 检查 Brew 或 Port
 */
export const CheckBrewOrPort = (sendGlobalUpdate: () => void) => {
  if (isMacOS()) {
    checkMacOSBrew(sendGlobalUpdate)
    checkMacPorts(sendGlobalUpdate)
    checkSdkman(sendGlobalUpdate)
  } else if (isLinux()) {
    checkLinuxBrew(sendGlobalUpdate)
    checkSdkman(sendGlobalUpdate)
  }
}
