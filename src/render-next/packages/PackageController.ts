import type { ManagedVersionDirectory } from '@shared/VersionDelete'
import { FORCE_DELETE_CONFIRMATION } from '@shared/VersionDelete'
import { packageError, packageKey, PackageOutcomeUnknown, type InstalledPackage, type PackageCatalog, type PackageOperation, type PackageVersion } from './types'

export type PackageDependencies = {
  list(flag: string): Promise<{ versions: PackageVersion[]; warning?: string }>
  installed(flag: string, fresh: boolean): Promise<InstalledPackage[]>
  install(item: Readonly<PackageVersion>, progress: (value: number) => void): Promise<void>
  inspect(item: Readonly<PackageVersion>): Promise<ManagedVersionDirectory | undefined>
  remove(item: Readonly<PackageVersion>, directory: ManagedVersionDirectory, confirmation: string): Promise<boolean>
  notice(message: string): void
  changed(flag: string): void
  ready(): boolean
}

export class PackageController {
  catalogs: Record<string, PackageCatalog> = {}
  operation?: PackageOperation
  private loads = new Map<string, Promise<PackageCatalog>>()
  private mutation?: Promise<boolean>

  constructor(private deps: PackageDependencies) {}

  catalog(flag: string): PackageCatalog {
    this.catalogs[flag] ??= { loading: false, loaded: false, error: '', warning: '', versions: [], installed: [] }
    // The assignment expression returns the raw initializer on first access.
    // Read back through the controller proxy so asynchronous updates render.
    return this.catalogs[flag]
  }

  load(flag: string, fresh = false): Promise<PackageCatalog> {
    const pending = this.loads.get(flag)
    if (pending) return pending
    const catalog = this.catalog(flag)
    if (catalog.loaded && !fresh) return Promise.resolve(catalog)
    catalog.loading = true; catalog.error = ''; catalog.warning = ''
    const flight = Promise.resolve().then(async () => {
      if (!this.deps.ready()) throw new Error('The desktop connection is not ready. Retry after startup completes.')
      // Publish each source as soon as it resolves. A slow online catalog must
      // not hide installed versions, and a slow installed scan must not leave
      // the Available tab looking empty.
      let onlineOk = false
      let localOk = false
      const online = this.deps.list(flag).then((result) => {
        catalog.versions = result.versions
        catalog.warning = result.warning ?? ''
        onlineOk = true
      }).catch((error) => { catalog.error = packageError(error) })
      const local = this.deps.installed(flag, fresh).then((installed) => {
        catalog.installed = installed
        localOk = true
      }).catch((error) => { catalog.warning = [catalog.warning, 'Installed versions could not be refreshed: ' + packageError(error)].filter(Boolean).join(' ') })
      await Promise.all([online, local])
      catalog.loaded = onlineOk && localOk
      // A concurrent refresh may finish before an active mutation. Keep its terminal fact.
      const operation = this.operation
      if (operation?.typeFlag === flag && operation.status === 'success') {
        const item = catalog.versions.find((item) => packageKey(item) === operation.key)
        if (item) item.installed = operation.action === 'install'
      }
      return catalog
    }).catch((error) => { catalog.error = packageError(error); return catalog })
      .finally(() => { catalog.loading = false; this.loads.delete(flag) })
    this.loads.set(flag, flight)
    return flight
  }

  install(item: PackageVersion): Promise<boolean> {
    return this.mutate(item, 'install', async (snapshot, operation) => {
      await this.deps.install(snapshot, (progress) => {
        if (!Number.isFinite(progress)) return
        operation.progress = Math.max(0, Math.min(100, progress))
        operation.message = operation.progress >= 100 ? 'Download complete. Finishing installation…' : 'Downloading package…'
      })
      this.markInstalled(snapshot, true)
    })
  }

  remove(item: PackageVersion, directory: ManagedVersionDirectory, confirmation: string): Promise<boolean> {
    if (confirmation !== FORCE_DELETE_CONFIRMATION) return Promise.resolve(false)
    const expected = Object.freeze({ ...directory })
    return this.mutate(item, 'remove', async (snapshot) => {
      const current = await this.deps.inspect(snapshot)
      if (!current || current.identity !== expected.identity || current.path !== expected.path || current.bin !== expected.bin) {
        throw new Error('The package directory changed. Open the removal confirmation again.')
      }
      if (!await this.deps.remove(snapshot, expected, confirmation)) throw new Error('The version could not be removed. It may still be in use.')
      this.markInstalled(snapshot, false)
    })
  }

  private mutate(item: PackageVersion, action: 'install' | 'remove', work: (snapshot: Readonly<PackageVersion>, operation: PackageOperation) => Promise<void>): Promise<boolean> {
    const key = packageKey(item)
    if (this.mutation) return this.operation?.key === key && this.operation.action === action ? this.mutation : Promise.resolve(false)
    // Unknown outcome never authorizes replay of a request that may still be running.
    if (this.operation?.status === 'unknown') {
      this.notify(this.operation.message)
      return Promise.resolve(false)
    }
    const snapshot = Object.freeze(JSON.parse(JSON.stringify(item)) as PackageVersion)
    this.operation = { key, typeFlag: item.typeFlag, version: item.version, action, status: 'running', message: action === 'install' ? 'Preparing download…' : 'Stopping the version and removing its managed directory…' }
    // Read the reactive operation back after assignment; callbacks must mutate the proxy.
    const operation = this.operation
    const flight = Promise.resolve().then(async () => {
      if (!this.deps.ready()) throw new Error('The desktop connection is not ready.')
      if (!snapshot.typeFlag || !snapshot.version) throw new Error('Package information is incomplete.')
      await work(snapshot, operation)
      operation.status = 'success'; operation.progress = 100
      operation.message = `${snapshot.version} ${action === 'install' ? 'installed' : 'removed'}.`
      this.notify(operation.message)
      // The requested side effect is complete. Domain refresh is supplementary.
      try {
        this.catalog(snapshot.typeFlag).installed = await this.deps.installed(snapshot.typeFlag, true)
        this.deps.changed(snapshot.typeFlag)
      } catch (error) {
        this.catalog(snapshot.typeFlag).warning = `${operation.message} Refresh failed: ${packageError(error)}`
      }
      return true
    }).catch((error) => {
      operation.status = error instanceof PackageOutcomeUnknown ? 'unknown' : 'failed'
      operation.message = packageError(error)
      this.notify(operation.message)
      return false
    }).finally(() => { this.mutation = undefined })
    this.mutation = flight
    return flight
  }

  private markInstalled(snapshot: PackageVersion, installed: boolean) {
    const catalog = this.catalog(snapshot.typeFlag)
    for (const item of catalog.versions) if (packageKey(item) === packageKey(snapshot)) item.installed = installed
    if (!installed) catalog.installed = catalog.installed.filter((item) => item.bin !== snapshot.bin)
  }
  private notify(message: string) {
    try { this.deps.notice(message) } catch (error) { console.error('Package notice failed', error) }
  }
}
