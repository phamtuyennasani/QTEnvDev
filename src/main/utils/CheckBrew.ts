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
  runBrewChecks([brewBin], sendGlobalUpdate)
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

/**
 * Known Homebrew binary locations checked before PATH-dependent commands.
 * Apple Silicon default, Intel default, and legacy Intel path cover all supported macOS layouts.
 */
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
    if (!global.Server.BrewBin) {
      for (const s of brewBins) {
        if (existsSync(s)) {
          global.Server.BrewBin = s
          break
        }
      }
    }
    if (error) {
      global.Server.BrewError = error.toString()
    }
    sendGlobalUpdate()
  }

  executeBrewChecks(handleBrewCheck)
}

/**
 * 执行 Brew 检查命令
 */
const executeBrewChecks = (handleBrewCheck: (error?: Error) => void) => {
  // Resolve Brew binary from known absolute paths first; this avoids failures on fresh
  // machines where shell-env has not yet added /opt/homebrew/bin to PATH.
  for (const bin of KNOWN_BREW_PATHS) {
    if (existsSync(bin)) {
      global.Server.BrewBin = bin
      break
    }
  }

  const resolvePromise = global.Server.BrewBin
    ? Promise.resolve({ stdout: global.Server.BrewBin })
    : spawnPromiseWithEnv('which', ['brew'])

  resolvePromise
    .then((res) => {
      console.log('which brew: ', res)
      if (!global.Server.BrewBin) {
        const whichBin = res.stdout.trim()
        if (whichBin && existsSync(whichBin)) {
          global.Server.BrewBin = whichBin
        }
      }
      checkBrewRepo(handleBrewCheck)
      checkBrewCellar(handleBrewCheck)
    })
    .catch((e: Error) => {
      handleBrewCheck(e)
      console.log('which brew e: ', e)
    })
}

/**
 * 检查 Brew 仓库
 */
const checkBrewRepo = (handleBrewCheck: (error?: Error) => void) => {
  spawnPromiseWithEnv('brew', ['--repo'])
    .then((res) => {
      console.log('brew --repo: ', res)
      const dir = res.stdout
      global.Server.BrewHome = dir
      handleBrewCheck()
      makeRepoSafe(dir)
    })
    .catch((e: Error) => {
      handleBrewCheck(e)
      console.log('brew --repo err: ', e)
    })
}

/**
 * 检查 Brew Cellar
 */
const checkBrewCellar = (handleBrewCheck: (error?: Error) => void) => {
  spawnPromiseWithEnv('brew', ['--cellar'])
    .then((res) => {
      const dir = res.stdout
      console.log('brew --cellar: ', res)
      global.Server.BrewCellar = dir
      handleBrewCheck()
    })
    .catch((e: Error) => {
      handleBrewCheck(e)
      console.log('brew --cellar err: ', e)
    })
}

/**
 * 设置 Git 安全目录
 */
const makeRepoSafe = (dir: string) => {
  spawnPromiseWithEnv('git', [
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
