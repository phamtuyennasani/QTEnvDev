import { Base } from '../Base'
import { machineId } from '../../Fn'
import { ForkPromise } from '@shared/ForkPromise'
import { arch } from 'os'
import axios from 'axios'
import { isLinux, isMacOS, isWindows } from '@shared/utils'
import YAML from 'yamljs'
import { compareVersions } from '@shared/compare-versions'
import type { SoftInstalled } from '@shared/app'
import { isDEB } from '../../util/Linux'
import { GitHubAccountService } from './GitHubAccount'

class App extends Base {
  private readonly githubAccount = new GitHubAccountService()

  constructor() {
    super()
  }

  githubUserFetch() {
    return new ForkPromise(async (resolve) => {
      resolve(await this.githubAccount.fetchUser(global.Server.UserUUID ?? ''))
    })
  }

  githubLicenseFetch() {
    return new ForkPromise(async (resolve) => {
      resolve(await this.githubAccount.fetchLicenses(global.Server.UserUUID ?? ''))
    })
  }

  githubLicenseDelete(uuid: string, license: string) {
    return new ForkPromise(async (resolve) => {
      resolve(await this.githubAccount.deleteBinding(global.Server.UserUUID ?? '', uuid, license))
    })
  }

  githubLicenseAdd(uuid: string, license: string) {
    return new ForkPromise(async (resolve) => {
      resolve(await this.githubAccount.addBinding(global.Server.UserUUID ?? '', uuid, license))
    })
  }

  start(version: string) {
    return new ForkPromise(async (resolve, reject) => {
      const uuid_new = await machineId()
      const uuid = '#########'

      let os = ''
      if (isWindows()) {
        os = `Windows ${arch()}`
      } else if (isMacOS()) {
        os = `macOS ${arch()}`
      } else {
        os = `Linux ${arch()}`
      }

      const data = {
        uuid,
        uuid_new,
        os,
        version
      }

      console.log('data: ', data)
      axios({
        url: 'https://api.one-env.com/api/app/start',
        method: 'post',
        data,
        proxy: this.getAxiosProxy()
      })
        .then((res) => {
          if (res?.data?.code === 200) {
            const license = res?.data?.data?.license ?? ''
            resolve({
              'APP-Licenses-Code': license
            })
            return
          }

          resolve(true)
        })
        .catch((err) => {
          reject(err)
        })
    })
  }

  feedback(info: any) {
    return new ForkPromise(async (resolve, reject) => {
      const uuid = await machineId()

      const data = {
        uuid,
        ...info
      }

      console.log('data: ', data)

      axios({
        url: 'https://api.one-env.com/api/app/feedback_app',
        method: 'post',
        data,
        proxy: this.getAxiosProxy()
      })
        .then(() => {
          resolve(true)
        })
        .catch((e) => {
          reject(e)
        })
    })
  }

  licensesInit() {
    return new ForkPromise(async (resolve, _reject, on) => {
      // License check removed — always report active
      const data = {
        requestSuccess: true,
        uuid: '',
        activeCode: '',
        isActive: true
      }
      on({ 'APP-Licenses-Code': '' })
      resolve(data)
    })
  }

  licensesState() {
    return new ForkPromise(async (resolve, _reject, on) => {
      // License check removed — always report active, skip server call
      on({ 'APP-Licenses-Code': '' })
      resolve({ uuid: '', activeCode: '', isActive: true })
    })
  }

  licensesRequest(message: string) {
    return new ForkPromise(async (resolve, reject) => {
      const uuid = await machineId()
      const user_uuid = global.Server?.UserUUID ?? ''
      axios({
        url: 'https://api.one-env.com/api/app/active_code_request',
        method: 'post',
        data: {
          uuid,
          user_uuid,
          message
        },
        proxy: this.getAxiosProxy()
      })
        .then(() => {
          resolve(true)
        })
        .catch((e) => {
          reject(e)
        })
    })
  }

  checkAppVersionUpdate() {
    return new ForkPromise(async (resolve, reject) => {
      let file = 'latest.yml'
      const a = arch()
      if (isMacOS()) {
        if (a === 'x64') {
          file = 'latest-mac.yml'
        } else {
          file = 'latest-mac-arm64.yml'
        }
      } else if (isLinux()) {
        if (a === 'x64') {
          file = 'latest-linux.yml'
        } else {
          file = 'latest-linux-arm64.yml'
        }
      }
      try {
        const res = await axios({
          url: `https://raw.githubusercontent.com/xpf0000/QTEnvDev/refs/heads/master/${file}`,
          method: 'get',
          proxy: this.getAxiosProxy()
        })
        const content = res.data
        const json = YAML.parse(content)
        const version = json['version']
        const check = compareVersions(version, global.Server.APPVersion)
        let name = ''
        if (isMacOS()) {
          if (a === 'x64') {
            name = `QTEnvDev-${version}.dmg`
          } else {
            name = `QTEnvDev-${version}-arm64.dmg`
          }
        } else if (isLinux()) {
          const isdeb = await isDEB()
          const ext = isdeb ? '.deb' : '.rpm'
          if (a === 'x64') {
            name = `QTEnvDev-${version}-x64${ext}`
          } else {
            name = `QTEnvDev-${version}-arm64${ext}`
          }
        } else {
          name = `QTEnvDev-Setup-${version}.exe`
        }
        const url = `https://github.com/xpf0000/QTEnvDev/releases/download/v${version}/${name}`
        resolve({
          app: global.Server.APPVersion,
          online: version,
          check,
          url
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  getConfigFiles(_version?: SoftInstalled): Array<{ name: string; path: string }> {
    // App 模块负责启动上报/许可证/更新检查，不管理任何服务的配置文件
    return []
  }

  getLogFiles(_version?: SoftInstalled): Array<{ name: string; path: string }> {
    // App 模块没有独立的运行时日志文件
    return []
  }
}

export default new App()
