import { markRaw } from 'vue'
import IPC from '@/util/IPC'
import XTerm, { TerminalExitError } from '@/util/XTerm'
import { reactiveBind } from '@/util/Index'
import { clipboard, shell } from '@/util/NodeFn'
import { BrewStore } from '@/store/brew'
import { packageRequest } from '../packages/transport'
import { packageError } from '../packages/types'
import { supportsMacPorts } from '../packages/macportsSources'
import { showNotice } from './app'

export type MacPortsRow = { name: string; version: string; installed: boolean }
type MacPortsCatalog = { rows: MacPortsRow[]; loading: boolean; error: string; warning: string }
type MacPortsOperation = {
  flag: string
  name: string
  action: 'install' | 'uninstall'
  status: 'starting' | 'running' | 'stopping' | 'success' | 'failed' | 'cancelled' | 'unknown'
  error: string
}

const validPortName = /^[A-Za-z0-9][A-Za-z0-9+_.-]*$/
const portPath = () => window.Server?.MacPorts?.trim() ?? ''
const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'"

function packageNames(flag: string, name: string) {
  if (flag === 'php')
    return [name, ...['fpm', 'mysql', 'apache2handler', 'iconv'].map((part) => name + '-' + part)]
  if (flag === 'mysql' || flag === 'mariadb') return [name, name + '-server']
  if (flag === 'python') return [name, name.replace('python', 'py') + '-pip']
  return [name]
}

function buildCommands(flag: string, row: MacPortsRow, bin: string, arm: boolean) {
  const names = packageNames(flag, row.name).map(quote)
  const command = '/usr/bin/sudo /usr/bin/arch ' + (arm ? '-arm64' : '-x86_64') + ' ' + quote(bin)
  const change = row.installed ? 'uninstall' : 'install'
  if (change === 'install' && /^php5[2-6]$/.test(row.name)) {
    return names.map(
      (name) => command + ' install -v ' + name + ' configure.compiler=macports-clang-10'
    )
  }
  // MacPorts checks its own registered dependents before uninstalling.
  return [command + ' ' + change + ' -v ' + names.join(' ')]
}

class MacPortsPackagesController {
  private catalogs: Record<string, MacPortsCatalog> = {}
  private loads = new Map<string, Promise<void>>()
  private flight?: Promise<void>
  private terminal?: XTerm
  private stopFlight?: Promise<unknown>
  operation?: MacPortsOperation
  terminalError = ''

  get available() {
    return Boolean(
      window.Server?.isMacOS && /^\/[^\r\n\0]+$/.test(portPath()) && window.QTEnvDevNodeAPI
    )
  }

  get busy() {
    return Boolean(this.flight || this.operation?.status === 'unknown')
  }

  get canStop() {
    return (
      this.operation?.status === 'starting' ||
      this.operation?.status === 'running' ||
      this.operation?.status === 'unknown'
    )
  }

  get showTerminal() {
    return Boolean(this.terminal?.ptyKey || (this.flight && this.canStop))
  }

  catalog(flag: string) {
    this.catalogs[flag] ??= { rows: [], loading: false, error: '', warning: '' }
    return this.catalogs[flag]
  }

  load(flag: string): Promise<void> {
    if (!this.available || !supportsMacPorts(flag, window.Server)) return Promise.resolve()
    const active = this.loads.get(flag)
    if (active) return active
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

  private async fetch(flag: string, catalog: MacPortsCatalog) {
    try {
      const data = await packageRequest(IPC, 'app-fork:' + flag, ['portinfo', flag])
      if (!Array.isArray(data)) throw new Error('MacPorts returned an invalid package list.')
      const rows = new Map<string, MacPortsRow>()
      let skipped = 0
      for (const item of data) {
        if (
          typeof item?.name !== 'string' ||
          !validPortName.test(item.name) ||
          typeof item.version !== 'string' ||
          !item.version.trim()
        ) {
          skipped++
          continue
        }
        rows.set(item.name, {
          name: item.name,
          version: item.version,
          installed: item.installed === true
        })
      }
      catalog.rows = [...rows.values()]
      if (skipped) catalog.warning = skipped + ' invalid MacPorts entries were skipped.'
    } catch (error) {
      catalog.error = packageError(error)
    }
  }

  change(flag: string, row: MacPortsRow) {
    if (this.busy || !this.available || !supportsMacPorts(flag, window.Server)) return
    const catalog = this.catalog(flag)
    if (catalog.loading || catalog.error) return
    const current = catalog.rows.find(
      (item) => item.name === row.name && item.version === row.version
    )
    if (!current || current.installed !== row.installed) return
    const commands = buildCommands(flag, current, portPath(), window.Server.isArmArch === true)
    this.terminal?.destroy()
    const terminal = markRaw(new XTerm(false))
    this.terminal = terminal
    this.stopFlight = undefined
    this.terminalError = ''
    this.operation = {
      flag,
      name: current.name,
      action: current.installed ? 'uninstall' : 'install',
      status: 'starting',
      error: ''
    }
    const operation = this.operation
    this.flight = Promise.resolve()
      .then(() => this.run(terminal, operation, commands))
      .finally(() => {
        this.flight = undefined
      })
    return this.flight
  }

  private async run(terminal: XTerm, operation: MacPortsOperation, commands: string[]) {
    try {
      await terminal.initialize()
      if (operation.status === 'stopping') {
        await this.stopTerminal(terminal)
        operation.status = 'cancelled'
        return
      }
      operation.status = 'running'
      await terminal.send(
        commands.map((command) => command + ' || exit $?'),
        'direct',
        true
      )
      if ((operation.status as MacPortsOperation['status']) === 'stopping') {
        await this.stopTerminal(terminal)
        operation.status = 'cancelled'
      } else {
        operation.status = 'success'
        const row = this.catalog(operation.flag).rows.find((item) => item.name === operation.name)
        if (row) row.installed = operation.action === 'install'
      }
    } catch (error) {
      const exitKnown = error instanceof TerminalExitError && typeof error.exitCode === 'number'
      if (!exitKnown && terminal.ptyKey) {
        try {
          await this.stopTerminal(terminal)
        } catch (stopError) {
          operation.status = 'unknown'
          operation.error = packageError(error) + ' ' + packageError(stopError)
          return
        }
      }
      const stopping = (operation.status as MacPortsOperation['status']) === 'stopping'
      operation.status = stopping ? 'cancelled' : 'failed'
      if (!stopping) operation.error = packageError(error)
    } finally {
      if (operation.status !== 'unknown') terminal.releaseProcessOutput()
    }
    await this.refreshAfterChange(operation.flag)
  }

  private async refreshAfterChange(flag: string) {
    const catalog = this.catalog(flag)
    const catalogRefresh = async () => {
      await this.loads.get(flag)
      await this.load(flag)
    }
    const module = BrewStore().module(flag)
    const [_, installed] = await Promise.allSettled([
      catalogRefresh(),
      module.fetchInstalled(false, { fresh: true })
    ])
    if (installed.status === 'rejected' || !installed.value) {
      catalog.warning = [catalog.warning, 'Installed versions could not be refreshed.']
        .filter(Boolean)
        .join(' ')
    }
    window.dispatchEvent(new CustomEvent('pqt-packages-changed', { detail: flag }))
  }

  private stopTerminal(terminal: XTerm) {
    this.stopFlight ??= terminal.stop()
    return this.stopFlight
  }

  async cancel() {
    const terminal = this.terminal
    const operation = this.operation
    if (!terminal || !operation || !this.canStop) return
    const previous = operation.status
    operation.status = 'stopping'
    if (terminal.ptyKey) {
      try {
        await this.stopTerminal(terminal)
      } catch (error) {
        this.stopFlight = undefined
        if ((operation.status as MacPortsOperation['status']) === 'stopping')
          operation.status = previous
        this.terminalError = 'MacPorts could not be stopped. ' + packageError(error)
        return
      }
    }
    if (this.flight) await this.flight
    if ((operation.status as MacPortsOperation['status']) === 'stopping') {
      operation.status = 'cancelled'
      terminal.releaseProcessOutput()
      await this.refreshAfterChange(operation.flag)
    }
  }

  async attach(element: HTMLElement) {
    const terminal = this.terminal
    if (!terminal || terminal.dom === element || !this.showTerminal) return
    try {
      await terminal.mount(element)
    } catch (error) {
      if (terminal.dom === element) {
        this.terminalError = packageError(error)
        terminal.unmounted()
      }
    }
  }

  detach(element: HTMLElement) {
    if (this.terminal?.dom === element) this.terminal.unmounted()
  }

  async copyCommand(flag: string, row: MacPortsRow) {
    if (!this.available || !supportsMacPorts(flag, window.Server) || !validPortName.test(row.name))
      return
    try {
      await clipboard.writeText(
        buildCommands(flag, row, portPath(), window.Server.isArmArch === true).join('\n')
      )
      showNotice('MacPorts command copied.')
    } catch (error) {
      showNotice(packageError(error))
    }
  }

  async openGuide() {
    try {
      await shell.openExternal('https://www.macports.org/install.php')
    } catch (error) {
      showNotice(packageError(error))
    }
  }
}

export const macportsPackages = reactiveBind(new MacPortsPackagesController())
