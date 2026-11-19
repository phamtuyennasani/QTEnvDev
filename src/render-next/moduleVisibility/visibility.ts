import { AppModules } from '@/core/App'
import type { AllAppModule } from '@/core/type'
import { AppStore } from '@/store/app'

export function isBuiltinModuleSupported(flag: AllAppModule) {
  const supported = AppModules.find((module) => module.typeFlag === flag)?.platform
  if (!supported) return true
  const server = window.Server
  if (server?.isWindows) return supported.includes('Windows')
  if (server?.isMacOS) return supported.includes('macOS')
  if (server?.isLinux) return supported.includes('Linux')
  return false
}

export function isBuiltinModuleVisible(flag: AllAppModule) {
  return isBuiltinModuleSupported(flag) && AppStore().config.setup.common.showItem?.[flag] !== false
}
