import { AppCustomerModule } from '@/core/Module'
import type { ModuleCustomer } from '@/core/ModuleCustomer'
import type { StartupGroupInstalledTarget, StartupGroupRuntimeModule } from '../type'

const modulePrefix = 'custom-module:'

const findModule = (flag: string): ModuleCustomer | undefined => {
  if (!flag.startsWith(modulePrefix)) return undefined
  return AppCustomerModule.module.find((module) => module.isService && `${modulePrefix}${module.id}` === flag)
}

export const isCustomStartupModule = (flag: string) => flag.startsWith(modulePrefix)

export function listCustomStartupModules(): StartupGroupRuntimeModule[] {
  return AppCustomerModule.module.filter((module) => module.isService).map((module) => ({
    typeFlag: `${modulePrefix}${module.id}`,
    moduleType: 'other',
    label: module.label,
    isService: true,
    allowMultiple: !module.isOnlyRunOne
  }))
}

export function customStartupTargets(flag: string): StartupGroupInstalledTarget[] {
  const module = findModule(flag)
  if (!module) return []
  return module.item.map((item) => ({
    version: item.name,
    bin: item.name,
    path: item.id,
    displayPath: module.label,
    enable: true,
    get run() { return item.run },
    get running() { return item.running },
    get startOutcomeUnknown() { return item.startOutcomeUnknown },
    start(interactive = true) {
      if (findModule(flag) !== module || !module.item.includes(item)) {
        return Promise.resolve('The custom command changed. Select the current command and try again.')
      }
      return item.start(interactive)
    },
    stop: (interactive = true) => item.stop(interactive)
  }))
}

export const customStartupModuleLabel = (flag: string) => findModule(flag)?.label
