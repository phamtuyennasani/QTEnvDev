import IPC from '@/util/IPC'
import { reactiveBind } from '@/util/Index'
import { shell } from '@/util/NodeFn'
import { homebrewUpgrade } from '@/components/VersionManager/brew/Controller'
import { findInstalledFormulaConflict } from '@/components/VersionManager/brew/FormulaConflict'
import type { BrewUpgradePreview } from '@fork/module/Brew/UpgradeTypes'
import { homebrewTaps, supportsHomebrew } from '../packages/homebrewSources'
import { packageRequest } from '../packages/transport'
import { PackageOutcomeUnknown, packageError } from '../packages/types'
import { showNotice } from './app'
import { homebrewBootstrap } from './homebrewBootstrapController'

export type HomebrewFormula = { name: string; version: string; installed: boolean }
type HomebrewCatalog = { rows: HomebrewFormula[]; loading: boolean; error: string; warning: string }

class HomebrewPackagesController {
  private catalogs: Record<string, HomebrewCatalog> = {}
  private loads = new Map<string, Promise<void>>()
  private tapUnknown = new Set<string>()
  pendingFlag = ''
  operationFlag = ''

  get available() {
    return Boolean(window.Server?.BrewBin && window.Server?.BrewCellar && window.QTEnvDevNodeAPI)
  }

  get busy() {
    return Boolean(this.pendingFlag || homebrewUpgrade.busy || homebrewBootstrap.busy)
  }

  catalog(flag: string) {
    this.catalogs[flag] ??= { rows: [], loading: false, error: '', warning: '' }
    return this.catalogs[flag]
  }

  load(flag: string): Promise<void> {
    if (!this.available || !supportsHomebrew(flag, window.Server)) return Promise.resolve()
    const pending = this.loads.get(flag)
    if (pending) return pending
    const catalog = this.catalog(flag)
    catalog.loading = true
    catalog.error = ''
    catalog.warning = ''
    const flight = this.fetch(flag, catalog).finally(() => {
      catalog.loading = false
      this.loads.delete(flag)
    })
    this.loads.set(flag, flight)
    return flight
  }

  private async fetch(flag: string, catalog: HomebrewCatalog) {
    try {
      const data = await packageRequest(IPC, 'app-fork:' + flag, ['brewinfo', flag])
      if (!Array.isArray(data)) throw new Error('Homebrew returned an invalid formula list.')
      const rows = new Map<string, HomebrewFormula>()
      for (const row of data) {
        if (typeof row?.name !== 'string' || !row.name || typeof row.version !== 'string') continue
        rows.set(row.name, { name: row.name, version: row.version, installed: row.installed === true })
      }
      catalog.rows = [...rows.values()]
      if (flag === 'php' && window.Server.isMacOS) {
        try {
          await homebrewUpgrade.loadCatalog(catalog.rows.map((row) => row.name))
        } catch (error) {
          catalog.warning = 'Some PHP upgrade details could not be loaded. ' + packageError(error)
        }
      }
    } catch (error) {
      catalog.error = packageError(error)
    }
  }

  async change(flag: string, name: string, installed: boolean) {
    if (this.busy) return
    const catalog = this.catalog(flag)
    const row = catalog.rows.find((item) => item.name === name)
    if (!this.available || !supportsHomebrew(flag, window.Server) || !row ||
        row.installed !== installed || catalog.loading || catalog.error) return
    if (findInstalledFormulaConflict(row, catalog.rows)) return
    await this.mutate(flag, () => homebrewUpgrade.package({ name, installed, typeFlag: flag }), () => {
      row.installed = !installed
    })
  }

  async prepareUpgrade(name: string) {
    if (!this.available || !window.Server.isMacOS || this.busy) return
    const catalog = this.catalog('php')
    if (catalog.loading || catalog.error || !catalog.rows.some((row) => row.name === name)) return
    if (!homebrewUpgrade.catalog[name]?.eligible) return
    this.operationFlag = 'php'
    try {
      return await homebrewUpgrade.prepare(name)
    } catch (error) {
      showNotice(packageError(error))
      return undefined
    }
  }

  async upgrade(preview: BrewUpgradePreview) {
    if (!this.available || !window.Server.isMacOS || this.busy) return
    await this.mutate('php', () => homebrewUpgrade.confirm(preview))
  }

  private async mutate(
    flag: string,
    action: () => ReturnType<typeof homebrewUpgrade.package>,
    committed?: () => void
  ) {
    this.pendingFlag = this.operationFlag = flag
    try {
      const result = await action()
      if (result.outcome === 'succeeded') {
        committed?.()
        // A manual refresh can have sampled the system before the mutation completed.
        await this.loads.get(flag)
        await this.load(flag)
        window.dispatchEvent(new CustomEvent('pqt-packages-changed', { detail: flag }))
      }
    } catch (error) {
      showNotice(packageError(error))
    } finally {
      this.pendingFlag = ''
    }
  }

  tapBlocked(flag: string) {
    return this.tapUnknown.has(flag)
  }

  async enableTap(flag: string) {
    const tap = homebrewTaps[flag]
    if (!tap || this.busy || !this.available || !supportsHomebrew(flag, window.Server) || this.tapBlocked(flag)) return
    this.pendingFlag = flag
    try {
      const result = await packageRequest(IPC, 'app-fork:brew', ['addTap', tap], {
        mutation: true,
        timeout: 10 * 60_000
      })
      if (result !== 1 && result !== 2) throw new Error('Homebrew did not confirm the tap.')
      await this.loads.get(flag)
      await this.load(flag)
      showNotice(this.catalog(flag).error ? 'Tap enabled. Formula refresh failed.' : 'Tap enabled.')
    } catch (error) {
      if (error instanceof PackageOutcomeUnknown) this.tapUnknown.add(flag)
      showNotice(packageError(error))
    } finally {
      this.pendingFlag = ''
    }
  }

  async openInstallGuide() {
    try {
      await shell.openExternal('https://brew.sh/')
    } catch (error) {
      showNotice(packageError(error))
    }
  }
}

export const homebrewPackages = reactiveBind(new HomebrewPackagesController())
