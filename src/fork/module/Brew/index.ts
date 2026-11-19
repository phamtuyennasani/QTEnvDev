import { join } from 'path'
import { Base } from '../Base'
import { getUpgradeCatalog, inspectUpgrade, getBrewIdentity, formulaName } from './UpgradeCatalog'
import { BrewPackageRunner } from './BrewPackageRunner'
import type { BrewFormulaSnapshot, BrewPackageAction } from './UpgradeTypes'
import EnvSync from '@shared/EnvSync'
import { execPromiseWithEnv, spawnPromiseWithEnv } from '../../Fn'
import { identifyHomebrewMirror, isHomebrewMirror } from '@shared/homebrewMirrors'
import { ForkPromise } from '@shared/ForkPromise'
import type { SoftInstalled } from '@shared/app'

class Brew extends Base {
  private packageRunner = new BrewPackageRunner()
  private changingMirror = false
  constructor() {
    super()
  }

  getUpgradeCatalog(formulas: string[]) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        resolve(await getUpgradeCatalog(global.Server.BrewBin!, formulas, await EnvSync.sync()))
      } catch (error) {
        reject(error)
      }
    })
  }

  inspectUpgrade(name: string) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        resolve(await inspectUpgrade(global.Server.BrewBin!, name, await EnvSync.sync()))
      } catch (error) {
        reject(error)
      }
    })
  }

  packageSnapshot(name: string) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        const identity = await getBrewIdentity(global.Server.BrewBin!, await EnvSync.sync())
        resolve({ identity, formula: formulaName(name), affectedRacks: [identity.cellar] })
      } catch (error) {
        reject(error)
      }
    })
  }

  runPackage(action: BrewPackageAction, snapshot: BrewFormulaSnapshot, id: string) {
    return new ForkPromise(async (resolve, reject, on) => {
      try {
        const identity = await getBrewIdentity(global.Server.BrewBin!, await EnvSync.sync())
        if (JSON.stringify(identity) !== JSON.stringify(snapshot.identity))
          throw new Error('Homebrew identity changed')
        resolve(
          await this.packageRunner.runPackage(
            action,
            snapshot,
            id,
            (msg) => on(msg),
            await EnvSync.sync()
          )
        )
      } catch (error) {
        resolve({ operationId: id, action, outcome: 'failed', error: String(error), logs: '' })
      }
    })
  }

  addTap(name: string) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        const bin = global.Server.BrewBin || 'brew'
        const stdout = (await spawnPromiseWithEnv(bin, ['tap'], { shell: false })).stdout
        if (!stdout.split(/\r?\n/).some((tap) => tap.trim() === name)) {
          await spawnPromiseWithEnv(bin, ['tap', name], { shell: false })
          resolve(2)
        } else {
          resolve(1)
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  currentSrc() {
    return new ForkPromise(async (resolve, reject) => {
      try {
        const brewHome = global.Server.BrewHome
        if (!brewHome) throw new Error('Homebrew is unavailable.')
        const { stdout: origin } = await spawnPromiseWithEnv(
          'git',
          [`--git-dir=${join(brewHome, '.git')}`, 'remote', 'get-url', 'origin'],
          { cwd: brewHome, shell: false }
        )
        if (!origin) throw new Error('Homebrew has no configured Git origin.')
        resolve(identifyHomebrewMirror(origin))
      } catch (e) {
        reject(e)
      }
    })
  }

  changeSrc(srcFlag: string) {
    return new ForkPromise(async (resolve, reject) => {
      if (this.changingMirror) {
        reject(new Error('A Homebrew mirror change is already running.'))
        return
      }
      if (!isHomebrewMirror(srcFlag)) {
        reject(new Error('Select a supported Homebrew mirror.'))
        return
      }
      const brewHome = global.Server.BrewHome
      if (process.platform !== 'darwin' || !brewHome) {
        reject(new Error('Homebrew mirror switching requires Homebrew on macOS.'))
        return
      }
      this.changingMirror = true
      try {
        const sh = join(global.Server.Static!, 'sh/brew-src.sh')
        const result = await spawnPromiseWithEnv('/bin/zsh', ['-f', sh, srcFlag, brewHome], {
          cwd: brewHome,
          shell: false
        })
        if (!result.stdout.split(/\r?\n/).includes('QTENVDEV_BREW_MIRROR_APPLIED')) {
          throw new Error('Homebrew mirror changes could not be confirmed.')
        }
        resolve(true)
      } catch (e) {
        reject(e)
      } finally {
        this.changingMirror = false
        // A partial write can also change the environment read from the profiles.
        void EnvSync.clean()
      }
    })
  }

  fetchAllPhpExtensions(num: string) {
    return new ForkPromise(async (resolve, reject) => {
      const names: { [k: string]: string } = {
        pecl_http: 'http.so',
        phalcon3: 'phalcon.so',
        phalcon4: 'phalcon.so',
        phalcon5: 'phalcon.so'
      }
      const zend = ['xdebug']
      try {
        const allTap = await execPromiseWithEnv('brew tap')
        if (!allTap.stdout.includes('shivammathur/extensions')) {
          await execPromiseWithEnv('brew tap shivammathur/extensions')
        }
        const command = `brew search --formula "/shivammathur\\/extensions\\/[\\s\\S]+${num}$/"`
        let content: any = await execPromiseWithEnv(command)
        content = content.stdout
          .split('\n')
          .filter((s: string) => !!s.trim())
          .map((s: string) => {
            const name = s.replace('shivammathur/extensions/', '').replace(`@${num}`, '')
            const res: { [k: string]: any } = {
              name,
              libName: s,
              installed: false,
              status: false,
              soname: names[name] ?? `${name}.so`,
              flag: 'homebrew'
            }
            if (zend.includes(name)) {
              res['extendPre'] = 'zend_extension='
            }
            return res
          })
        resolve(content)
      } catch (err) {
        reject(err)
      }
    })
  }

  fetchAllPhpExtensionsByPort(num: string) {
    return new ForkPromise(async (resolve, reject) => {
      const names: { [k: string]: string } = {
        pecl_http: 'http.so',
        phalcon3: 'phalcon.so',
        phalcon4: 'phalcon.so',
        phalcon5: 'phalcon.so',
        tideways_xhprof: 'xhprof.so',
        postgresql: 'pgsql.so',
        mysql: 'mysqli.so'
      }
      const zend: Array<string> = ['xdebug']
      try {
        const numStr = `${num}`.split('.').join('')
        const command = `port search --name --line php${numStr}-`
        console.log('command: ', command)
        let res: any = await execPromiseWithEnv(command)
        res = res?.stdout.toString() ?? ''
        const arr = res
          .split('\n')
          .filter((f: string) => {
            return !!f.trim() && !f.includes('lang www')
          })
          .map((m: string) => {
            const a = m.split('\t').filter((f) => f.trim().length > 0)
            const libName = a.shift() ?? ''
            const name = libName.replace(`php${numStr}-`, '').toLowerCase()
            const item: { [k: string]: any } = {
              name,
              libName,
              installed: false,
              status: false,
              soname: names[name] ?? `${name}.so`,
              flag: 'macports'
            }
            if (zend.includes(name)) {
              item['extendPre'] = 'zend_extension='
            }
            return item
          })
        resolve(arr)
      } catch (err) {
        reject(err)
      }
    })
  }

  getConfigFiles(_version?: SoftInstalled): Array<{ name: string; path: string }> {
    return []
  }

  getLogFiles(_version?: SoftInstalled): Array<{ name: string; path: string }> {
    return []
  }
}

export default new Brew()
