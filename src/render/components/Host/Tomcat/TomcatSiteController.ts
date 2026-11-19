import type { AppHost as ForkAppHost } from '@shared/app'
import { I18nT } from '@lang/index'
import { AppStore, type AppHost } from '@/store/app'
import { BrewStore } from '@/store/brew'
import { HostStore } from '@/components/Host/store'
import { TomcatSetup, tomcatCatalinaBase } from '@/components/Tomcat/setup'
import { registerTomcatLifecycle } from '@/components/Tomcat/lifecycle'
import { MessageError, MessageSuccess, MessageWarning } from '@/util/Element'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'
import { reactiveBind } from '@/util/Index'
import { ensureDataDirectoryReady } from '@/core/DataDirectoryStartup'
import {
  TomcatSiteSaveOperation,
  TomcatSiteOutcomeUnknown,
  type TomcatSiteSavePhase,
  type TomcatSaveRequest,
  type TomcatSaveResult
} from './TomcatSiteSaveOperation'

export { TomcatSiteSaveOperation } from './TomcatSiteSaveOperation'

export class TomcatSiteController {
  saving = false
  phase: TomcatSiteSavePhase = 'idle'
  private readonly operation = new TomcatSiteSaveOperation({
    persist: (request) => this.persist(request),
    applyHosts: (hosts) => {
      AppStore().UPDATE_HOSTS(hosts as AppHost[])
      HostStore.updateCurrentList()
    },
    writeHosts: async () => {
      const { write, ipv6 } = AppStore().config.setup.hosts
      const result = await forkTerminalRequest(
        'app-fork:host', ['writeHosts', write, ipv6 ?? true], 'Hosts file sync timed out.', 60_000
      )
      if (result.code !== 0 || result.data !== true) {
        throw new Error(result.msg || 'Hosts file sync was not confirmed.')
      }
    },
    restart: (request) => this.restart(request)
  })

  get committed() {
    return this.operation.committed
  }

  get warning() {
    return this.phase === 'savedWithWarning' ? this.operation.error?.message : undefined
  }

  get error() {
    return this.operation.error?.message
  }

  async save(host: AppHost, flag: 'add' | 'edit' | 'del', old?: AppHost): Promise<boolean> {
    if (this.saving || this.phase === 'unknown') {
      return false
    }
    this.saving = true
    this.phase = 'saving'
    try {
      const snapshot = {
        host: JSON.parse(JSON.stringify(host)) as ForkAppHost,
        old: JSON.parse(JSON.stringify(old ?? {})) as ForkAppHost
      }
      if (!(await ensureDataDirectoryReady())) {
        this.phase = 'failed'
        return false
      }
      const store = BrewStore()
      const module = store.module('tomcat')
      if (!module.installed.length && !await module.fetchInstalled(false)) {
        throw new Error('Installed Tomcat versions could not be loaded.')
      }
      const version = this.runningVersion() ?? store.currentVersion('tomcat') ?? module.installed[0]
      if (!version) {
        this.phase = 'failed'
        MessageError(I18nT('base.needSelectVersion'))
        return false
      }
      registerTomcatLifecycle()
      await TomcatSetup.init()
      const wasRunning = !!version.run
      const request: TomcatSaveRequest = {
        ...snapshot,
        flag,
        version: JSON.parse(JSON.stringify(version)),
        catalinaBase: tomcatCatalinaBase(version),
        wasRunning
      }
      const result = await this.operation.save(request)
      this.phase = this.operation.phase
      if (result) {
        if (this.phase === 'savedWithWarning') {
          MessageWarning(this.operation.error?.message ?? I18nT('host.warning'))
        } else {
          MessageSuccess(I18nT('base.success'))
        }
      } else {
        MessageError(this.operation.error?.message ?? I18nT('base.fail'))
      }
      return result
    } catch (error) {
      this.phase = 'failed'
      MessageError(error instanceof Error ? error.message : I18nT('base.fail'))
      return false
    } finally {
      this.saving = false
    }
  }

  private runningVersion() {
    return BrewStore()
      .module('tomcat')
      .installed.find((item) => item.run)
  }

  private restart(request: TomcatSaveRequest): Promise<string | boolean> {
    const version = BrewStore()
      .module('tomcat')
      .installed.find((item) => item.bin === request.version?.bin)
    return version?.restart() ?? Promise.resolve('The previously running Tomcat version was not found.')
  }

  private async persist(request: TomcatSaveRequest): Promise<TomcatSaveResult> {
    let response
    try {
      response = await forkTerminalRequest(
        'app-fork:tomcat',
        ['saveSite', request.version, request.catalinaBase, request.host, request.flag, request.old],
        'Tomcat did not return the website change result.'
      )
    } catch (error) {
      throw new TomcatSiteOutcomeUnknown(String(error))
    }
    if (response.errorCode === 'TOMCAT_SITE_OUTCOME_UNKNOWN' || (response.code === 0 && !Array.isArray(response.data?.host))) {
      throw new TomcatSiteOutcomeUnknown(response.msg || 'The Tomcat website change could not be verified.')
    }
    if (response.code !== 0) throw new Error(response.msg ?? I18nT('base.fail'))
    return response.data
  }
}

export default reactiveBind(new TomcatSiteController())
