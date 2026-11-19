import { join } from 'node:path'
import { Base } from '../Base'
import { ForkPromise } from '@shared/ForkPromise'
import { execPromiseWithEnv, versionFixed } from '../../Fn'
import { compareVersions } from '@shared/compare-versions'
import { quotePosixShell } from '@shared/Gvm'
import { isWindows } from '@shared/utils'
import type { SoftInstalled } from '@shared/app'
import { parseSdkmanJavaOutput, parseSdkmanVersionOutput } from './parser'

const supportedCandidates = ['java', 'maven', 'gradle'] as const
type Candidate = (typeof supportedCandidates)[number]

class Sdkman extends Base {
  sdkmaninfo(flag: Candidate) {
    return new ForkPromise(async (resolve) => {
      if (isWindows() || !supportedCandidates.includes(flag)) {
        throw new Error('SDKMAN candidate is not supported.')
      }
      const home = global.Server.SdkmanHome
      if (!home) throw new Error('SDKMAN was not found.')
      const init = quotePosixShell(join(home, 'bin/sdkman-init.sh'))
      const command = 'bash -c ' + quotePosixShell('source ' + init + ' && sdk list ' + flag)
      const result = await execPromiseWithEnv(command, { timeout: 60_000 })
      if (flag === 'java') {
        resolve(parseSdkmanJavaOutput(result.stdout))
        return
      }
      const rows = parseSdkmanVersionOutput(result.stdout, flag)
      rows.sort((left, right) =>
        compareVersions(versionFixed(right.version), versionFixed(left.version))
      )
      resolve(rows)
    })
  }

  getConfigFiles(_version?: SoftInstalled): Array<{ name: string; path: string }> {
    return []
  }

  getLogFiles(_version?: SoftInstalled): Array<{ name: string; path: string }> {
    return []
  }
}

export default new Sdkman()
