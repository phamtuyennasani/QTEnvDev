import IPC from '@/util/IPC'
import { BrewStore } from '@/store/brew'
import { versionDelete, shell } from '@/util/NodeFn'
import { packageModule } from '../packages/catalog'
import { packageRequest } from '../packages/transport'
import type { InstalledPackage, PackageVersion } from '../packages/types'
export type { PackageVersion } from '../packages/types'

const invoke = (flag: string, args: unknown[], options: Parameters<typeof packageRequest>[3] = {}) => packageRequest(IPC, 'app-fork:' + flag, args, options)
const nodePaths = (version: string) => {
  const appDir = String(window.Server.AppDir ?? '').replace(/[\\/]+$/, '') + '/nodejs/v' + version
  return { appDir, bin: appDir + (window.Server.isWindows ? '/node.exe' : '/bin/node') }
}
export async function fetchPackageVersions(flag: string): Promise<{ versions: PackageVersion[]; warning?: string }> {
  const provider = packageModule(flag)
  if (!provider.catalog) return { versions: [], warning: 'This module uses a dedicated installer. Its migration is listed in the feature audit.' }
  if (provider.catalog === 'node') {
    const [online, local] = await Promise.all([invoke(flag, ['allVersion']), invoke(flag, ['localVersion', 'default'])]) as [{ all?: unknown[] }, { versions?: string[] }]
    if (!Array.isArray(online?.all)) throw new Error('The Node.js catalog returned an invalid response.')
    const versions = online.all.filter((version): version is string => typeof version === 'string' && /^\d+(?:\.\d+){1,3}$/.test(version)).map((version) => ({ typeFlag: flag, version, name: 'Node.js ' + version, ...nodePaths(version), installed: local.versions?.includes(version) ?? false }))
    return { versions }
  }
  const data = await invoke(flag, ['fetchAllOnlineVersion'])
  if (!Array.isArray(data)) throw new Error('The package catalog returned an invalid response for ' + provider.label)
  const versions: PackageVersion[] = []; let skipped = 0
  for (const row of data) {
    if (!row || typeof row !== 'object' || typeof row.version !== 'string' || !row.version || typeof row.bin !== 'string' || !row.bin || typeof row.appDir !== 'string' || !row.appDir || typeof row.url !== 'string' || !/^https?:\/\//i.test(row.url)) { skipped += 1; continue }
    versions.push({ ...row, typeFlag: flag })
  }
  return { versions, warning: skipped ? String(skipped) + ' package entries were skipped because their metadata was incomplete.' : undefined }
}
export async function installPackage(item: Readonly<PackageVersion>, progress: (value: number) => void): Promise<void> {
  const provider = packageModule(item.typeFlag)
  if (item.installed) throw new Error('This version is already installed.')
  if (!item.version) throw new Error('Package metadata is incomplete.')
  const report = (message: unknown) => {
    const value = message && typeof message === 'object' ? (message as { progress?: unknown }).progress : undefined
    if (typeof value === 'number' && Number.isFinite(value)) progress(value)
  }
  const options = { timeout: 30 * 60_000, mutation: true, progress: report }
  if (provider.catalog === 'node') {
    if (!/^\d+(?:\.\d+){1,3}$/.test(item.version)) throw new Error('Invalid Node.js version.')
    const result = await invoke('node', ['installOrUninstall', 'default', 'install', item.version], options) as { versions?: string[] }
    if (!result?.versions?.includes(item.version)) throw new Error('Node.js did not confirm that this version was installed.')
    return
  }
  if (!provider.catalog || !item.url || !item.bin || !item.appDir || !item.zip) throw new Error('The package cannot be installed because its metadata is incomplete.')
  const result = await invoke(item.typeFlag, ['installSoft', JSON.parse(JSON.stringify(item))], options)
  // Base.installSoft resolves false on a failed extraction; code 0 alone is not success.
  if (result !== true) throw new Error('The package could not be downloaded or extracted: ' + item.version)
}
const underManagedRoot = (path: string) => {
  const normalize = (value: string) => { const normalized = value.replace(/\\/g, '/').replace(/\/+$/, ''); return window.Server.isWindows ? normalized.toLowerCase() : normalized }
  const root = normalize(String(window.Server.AppDir ?? ''))
  return Boolean(root && normalize(path).startsWith(root + '/'))
}
export async function readInstalledPackages(flag: string, fresh: boolean): Promise<InstalledPackage[]> {
  if (flag === 'node') {
    const result = await invoke(flag, ['localVersion', 'default']) as { versions?: string[] }
    if (!Array.isArray(result?.versions)) throw new Error('Node.js did not return its installed versions.')
    return result.versions.filter((version) => /^\d+(?:\.\d+){1,3}$/.test(version)).map((version) => ({ typeFlag: flag, version, ...nodePaths(version), path: nodePaths(version).appDir, installed: true, managed: true }))
  }
  const module = BrewStore().module(flag)
  const ok = await module.fetchInstalled(false, { fresh })
  if (!ok) throw new Error('Installed-version discovery did not complete for ' + flag)
  return module.installed.map((item) => ({ typeFlag: flag, version: item.version || 'Unknown version', bin: item.bin, path: item.path, appDir: item.path, installed: true, managed: underManagedRoot(item.path) }))
}
export async function inspectPackage(item: Readonly<PackageVersion>) {
  if (!item.bin || !(item.appDir || item.path)) return undefined
  return versionDelete.inspect({ path: String(item.appDir || item.path), bin: item.bin })
}
export const revealPackage = (item: PackageVersion) => shell.showItemInFolder(String(item.appDir || item.path || item.bin || ''))
