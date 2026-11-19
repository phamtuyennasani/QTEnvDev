import { AppModules } from '@/core/App'
import { canSetModuleVisibility } from '@/core/ModuleVisibility'
import type { AllAppModule } from '@/core/type'
import { AppStore } from '@/store/app'
import { BrewStore } from '@/store/brew'
import { reactiveBind } from '@/util/Index'
import { isBuiltinModuleVisible } from './visibility'

async function stopWorkspaceService(flag: AllAppModule) {
  if (flag === 'dns') {
    const { dnsServer } = await import('../dnsServer/state')
    if (dnsServer.busy) throw new Error('Wait for DNS Server to finish its current operation.')
    await dnsServer.refresh()
    if (!dnsServer.status) throw new Error(dnsServer.error || 'DNS Server status is unavailable.')
    if (dnsServer.status.running && !(await dnsServer.change('stop')))
      throw new Error(dnsServer.error || 'Could not stop DNS Server.')
    return
  }
  if (flag === 'ftp-srv') {
    const { ftpAccounts } = await import('../ftpAccounts/state')
    const service = ftpAccounts['ftp-srv']
    if (service.busy) throw new Error('Wait for FTP Server to finish its current operation.')
    await service.refresh()
    if (!service.status) throw new Error(service.error || 'FTP Server status is unavailable.')
    if (service.status.running && !(await service.change('stop')))
      throw new Error(service.error || 'Could not stop FTP Server.')
  }
}

async function stopInstalledService(flag: AllAppModule) {
  // PHP and PHP-FPM share the PHP inventory. Hiding the CLI leaves a visible FPM running.
  if (flag === 'php' && isBuiltinModuleVisible('php-fpm')) return
  const module = BrewStore().module(flag === 'php-fpm' ? 'php' : flag)
  if (flag === 'mysql') {
    const { stopMysqlCompanions } = await import('@/components/Mysql/serviceLifecycle')
    const results = await Promise.allSettled([module.stop(), stopMysqlCompanions()])
    const errors = results.flatMap((result) =>
      result.status === 'rejected' ? [String(result.reason)]
        : result.value === true ? [] : [String(result.value)]
    )
    if (errors.length) throw new Error(errors.join('\n'))
    return
  }
  if (!module.installed.some(({ run, running }) => run || running) && !module.starting) return
  const result = await module.stop()
  if (result !== true)
    throw new Error(typeof result === 'string' ? result : 'Could not stop the service.')
}

class BuiltinModuleVisibilityController {
  pending?: AllAppModule
  error = ''

  async change(flag: AllAppModule, visible: boolean) {
    const module = AppModules.find((item) => item.typeFlag === flag)
    if (!module || this.pending || !window.QTEnvDevNodeAPI) return false
    if (isBuiltinModuleVisible(flag) === visible) return true
    this.pending = flag
    this.error = ''
    try {
      if (!(await canSetModuleVisibility(flag, visible))) return false
      if (!visible) {
        if (flag === 'dns' || flag === 'ftp-srv') await stopWorkspaceService(flag)
        else if (flag === 'cloudflare-tunnel') {
          const { changeCloudflareTunnels } = await import('../cloudflareTunnel/lifecycle')
          const result = await changeCloudflareTunnels('stop')
          if (result !== true) throw new Error(result)
        } else if (module.isService) await stopInstalledService(flag)
      }
      const store = AppStore()
      const previous = store.config.setup.common.showItem[flag]
      store.config.setup.common.showItem[flag] = visible
      try {
        await store.saveConfig()
      } catch (error) {
        if (previous === undefined) delete store.config.setup.common.showItem[flag]
        else store.config.setup.common.showItem[flag] = previous
        throw error
      }
      return true
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      return false
    } finally {
      this.pending = undefined
    }
  }
}

export const builtinModuleVisibility = reactiveBind(new BuiltinModuleVisibilityController())
