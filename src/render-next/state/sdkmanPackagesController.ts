import { markRaw } from 'vue'
import { BrewStore } from '@/store/brew'
import { reactiveBind } from '@/util/Index'
import XTerm, { TerminalExitError } from '@/util/XTerm'
import { quotePosixShell } from '@shared/Gvm'
import { packageError, type PackageVersion } from '../packages/types'
import {
  fetchSdkmanVersions,
  supportsSdkman,
  validSdkmanId,
  type SdkmanFlag
} from '../packages/sdkmanSources'
import { showNotice } from './app'

type Catalog = { loading: boolean; loaded: boolean; error: string; rows: PackageVersion[] }
type Action = 'install' | 'upgrade' | 'remove'
type Operation = {
  flag: SdkmanFlag
  identifier?: string
  action: Action
  status: 'running' | 'success' | 'failed' | 'unknown'
  message: string
  warning: string
}
const starting = { install: 'Installing', upgrade: 'Upgrading', remove: 'Removing' }
const completed = { install: 'installed', upgrade: 'upgrade finished', remove: 'removed' }
const command = { install: 'install', upgrade: 'upgrade', remove: 'uninstall' }

export class SdkmanPackagesController {
  private catalogs: Partial<Record<SdkmanFlag, Catalog>> = {}
  operation?: Operation
  terminalError = ''
  private terminal?: XTerm
  private loads = new Map<SdkmanFlag, Promise<Catalog>>()
  private mutation?: Promise<boolean>

  get available() {
    return Boolean(window.Server?.SdkmanHome && window.QTEnvDevNodeAPI)
  }
  get busy() {
    return Boolean(this.mutation) || this.operation?.status === 'unknown'
  }
  catalog(flag: SdkmanFlag) {
    this.catalogs[flag] ??= { loading: false, loaded: false, error: '', rows: [] }
    return this.catalogs[flag]
  }
  load(flag: SdkmanFlag, fresh = false) {
    const pending = this.loads.get(flag)
    if (pending) return pending
    const catalog = this.catalog(flag)
    if (!this.available || !supportsSdkman(flag, window.Server) || (catalog.loaded && !fresh)) {
      return Promise.resolve(catalog)
    }
    catalog.loading = true
    catalog.loaded = false
    catalog.error = ''
    const flight = fetchSdkmanVersions(flag)
      .then((rows) => {
        catalog.rows = rows
        catalog.loaded = true
        return catalog
      })
      .catch((error) => {
        catalog.error = packageError(error)
        return catalog
      })
      .finally(() => {
        catalog.loading = false
        this.loads.delete(flag)
      })
    this.loads.set(flag, flight)
    return flight
  }

  change(flag: SdkmanFlag, action: 'install' | 'remove', identifier: string) {
    return this.start(flag, action, identifier)
  }
  upgrade(flag: SdkmanFlag) {
    return this.start(flag, 'upgrade')
  }
  private start(flag: SdkmanFlag, action: Action, identifier?: string): Promise<boolean> {
    if (this.mutation) {
      return this.operation?.flag === flag &&
        this.operation.action === action &&
        this.operation.identifier === identifier
        ? this.mutation
        : Promise.resolve(false)
    }
    if (this.busy || !this.available || !supportsSdkman(flag, window.Server))
      return Promise.resolve(false)
    const catalog = this.catalog(flag)
    if (!catalog.loaded || catalog.loading) return Promise.resolve(false)
    if (action === 'upgrade') {
      if (!catalog.rows.some((item) => item.installed)) return Promise.resolve(false)
    } else {
      if (!validSdkmanId(identifier)) return Promise.resolve(false)
      const current = catalog.rows.find((item) => item.identifier === identifier)
      if (!current || current.installed !== (action === 'remove')) return Promise.resolve(false)
    }
    const sdkmanHome = window.Server.SdkmanHome
    if (!sdkmanHome || !sdkmanHome.startsWith('/') || /[\r\n\0]/.test(sdkmanHome))
      return Promise.resolve(false)
    const input = quotePosixShell(sdkmanHome.replace(/\/+$/, '') + '/bin/sdkman-init.sh')
    const sdk = ['sdk', command[action], flag, identifier].filter(Boolean).join(' ')
    const invocation = 'exec /bin/bash -c ' + quotePosixShell('source ' + input + ' && ' + sdk)
    const subject = identifier ? flag + ' ' + identifier : flag
    this.operation = {
      flag,
      identifier,
      action,
      status: 'running',
      message: starting[action] + ' ' + subject + '…',
      warning: ''
    }
    const operation = this.operation
    this.terminalError = ''
    this.terminal?.destroy()
    const terminal = markRaw(new XTerm())
    this.terminal = terminal
    const flight = this.run(terminal, operation, subject, invocation).finally(() => {
      this.mutation = undefined
    })
    this.mutation = flight
    return flight
  }
  private async run(terminal: XTerm, operation: Operation, subject: string, invocation: string) {
    try {
      await terminal.initialize()
      await terminal.send([invocation], 'direct', true)
      operation.status = 'success'
      operation.message = subject + ' ' + completed[operation.action] + '.'
    } catch (error) {
      operation.status = 'failed'
      operation.message = packageError(error)
      if (
        terminal.ptyKey &&
        !(error instanceof TerminalExitError && typeof error.exitCode === 'number')
      ) {
        try {
          await terminal.stop()
        } catch (stopError) {
          operation.status = 'unknown'
          operation.message =
            'SDKMAN did not confirm the result. Check the installation before restarting the app.'
          operation.warning = packageError(stopError)
        }
      }
    } finally {
      if (operation.status !== 'unknown') terminal.releaseProcessOutput()
    }
    try {
      showNotice(operation.message)
    } catch (error) {
      console.error(error)
    }
    if (operation.status === 'unknown') return false
    const flag = operation.flag
    await this.loads.get(flag)
    const catalog = await this.load(flag, true)
    if (catalog.error) operation.warning = 'SDKMAN catalog refresh failed: ' + catalog.error
    if (operation.status === 'success') {
      try {
        if (!(await BrewStore().module(flag).fetchInstalled(false, { fresh: true }))) {
          throw new Error('Installed versions could not be refreshed.')
        }
        window.dispatchEvent(new CustomEvent('pqt-packages-changed', { detail: flag }))
      } catch (error) {
        operation.warning = [operation.warning, packageError(error)].filter(Boolean).join(' ')
      }
    }
    return operation.status === 'success'
  }

  async attach(flag: SdkmanFlag, element: HTMLElement) {
    const terminal = this.terminal
    if (!terminal || this.operation?.flag !== flag || terminal.dom === element) return
    try {
      await terminal.mount(element)
      if (terminal.dom === element) this.terminalError = ''
    } catch (error) {
      if (terminal.dom === element) {
        terminal.unmounted()
        this.terminalError = packageError(error)
      }
    }
  }
  detach(element: HTMLElement) {
    if (this.terminal?.dom === element) this.terminal.unmounted()
  }
}

export const sdkmanPackages = reactiveBind(new SdkmanPackagesController())
