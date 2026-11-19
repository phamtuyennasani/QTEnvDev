import { packageModules } from './catalog'

export type PackageUpdateMode = 'version-replace' | 'legacy-upgrade' | 'unsupported'
export type PackageCapability = { flag: string; label: string; catalog: boolean; installed: boolean; current: boolean; install: boolean; update: PackageUpdateMode; remove: boolean; timeout: boolean; failure: boolean }

/** Source-backed capability inventory. Unsupported native upgrades remain explicit. */
export const packageCapabilities: PackageCapability[] = packageModules.map((module) => ({
  flag: module.flag,
  label: module.label,
  catalog: Boolean(module.catalog),
  installed: true,
  current: true,
  install: Boolean(module.catalog),
  update: module.flag === 'php' ? 'legacy-upgrade' : module.catalog ? 'version-replace' : 'unsupported',
  remove: Boolean(module.catalog),
  timeout: true,
  failure: true
}))

export const packageCapability = (flag: string) => packageCapabilities.find((item) => item.flag === flag)
