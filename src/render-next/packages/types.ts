export type PackageVersion = {
  typeFlag: string
  version: string
  name?: string
  channel?: string
  url?: string
  zip?: string
  bin?: string
  appDir?: string
  path?: string
  installed?: boolean
  downloaded?: boolean
  progress?: number
  [key: string]: unknown
}

export type InstalledPackage = PackageVersion & { bin: string; path: string; managed: boolean }
export type PackageCatalog = {
  loading: boolean
  loaded: boolean
  error: string
  warning: string
  versions: PackageVersion[]
  installed: InstalledPackage[]
}
export type PackageOperation = {
  key: string
  typeFlag: string
  version: string
  action: 'install' | 'remove'
  status: 'running' | 'success' | 'failed' | 'unknown'
  progress?: number
  message: string
}
export const packageKey = (item: PackageVersion) => JSON.stringify([item.typeFlag, item.bin || item.version, item.url || ''])
export const packageError = (error: unknown) => error instanceof Error ? error.message : String(error)
export class PackageOutcomeUnknown extends Error {}
