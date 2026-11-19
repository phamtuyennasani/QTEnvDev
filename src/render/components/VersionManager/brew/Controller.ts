import { ElMessage } from 'element-plus'
import { I18nT } from '@lang/index'
import { reactiveBind } from '@/util/Index'
import { BrewStore } from '@/store/brew'
import { ModuleInstalledItem } from '@/core/Module/ModuleInstalledItem'
import type { AllAppModule } from '@/core/type'
import { HomebrewUpgradeController } from './UpgradeController'
import type { BrewPackageResult } from '@fork/module/Brew/UpgradeTypes'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'

export const brewRequest = (
  action: string,
  args: unknown[],
  progress?: (data: string) => void
): Promise<any> => {
  const mutation = ['executeUpgrade', 'packageOperation'].includes(action)
  return forkTerminalRequest(
    'app-fork:brew',
    [action, ...args],
    'Homebrew did not return a result.',
    mutation ? 30 * 60_000 : 6 * 60_000,
    (info) => progress?.(String(info.msg ?? ''))
  ).then((info) => {
    if (info.code === 0) return info.data
    if (!mutation) throw new Error(info.msg || I18nT('base.fail'))
    return {
      operationId: '',
      action: action === 'executeUpgrade' ? 'upgrade' : args[0],
      outcome: info.outcome === 'unknown' ? 'unknown' : 'failed',
      error: info.msg,
      logs: ''
    }
  })
}

export const homebrewUpgrade = reactiveBind(
  new HomebrewUpgradeController({
    call: brewRequest,
    stop: async (target) => {
      // Main's accepted PID snapshot, not a stale mounted row, is the stop target.
      const item = new ModuleInstalledItem({ ...target.item, run: true, running: false })
      item.typeFlag = target.module as AllAppModule
      return item.stop()
    },
    refresh: async (flag) => {
      const module = BrewStore().module(flag as AllAppModule)
      module.installedFetched = false
      const results = await Promise.allSettled([
        module
          .fetchInstalled(false, { updateCurrent: false, pruneNotes: false, fresh: true })
          .then((ok) => {
            if (!ok) throw new Error('Installed version refresh failed')
          }),
        module.fetchBrew(true).then(async (ok) => {
          if (!ok) throw new Error('Homebrew catalog refresh failed')
          if (flag === 'php') await homebrewUpgrade.loadCatalog(module.brew.map((row) => row.name))
        })
      ])
      const errors = results.filter((r) => r.status === 'rejected')
      if (errors.length)
        throw new Error(
          errors.map((r) => (r.status === 'rejected' ? String(r.reason) : '')).join('\n')
        )
    },
    notify: (result: BrewPackageResult, refreshFailed: boolean) => {
      const key =
        result.outcome === 'succeeded'
          ? result.postprocessError
            ? 'brewPackagePartial'
            : refreshFailed
              ? 'brewUpgradeRefreshFailed'
              : result.action === 'upgrade'
                ? 'brewUpgradeSuccess'
                : 'brewPackageSuccess'
          : result.outcome === 'unknown'
            ? 'brewUpgradeUnknown'
            : 'brewUpgradeFailed'
      ElMessage({
        type:
          result.outcome === 'succeeded' && !refreshFailed && !result.postprocessError
            ? 'success'
            : 'warning',
        message: `${I18nT(`versionmanager.${key}`)}${result.postprocessError || result.error ? `\n${result.postprocessError || result.error}` : ''}`,
        duration: 7000,
        showClose: true
      })
    }
  })
)
