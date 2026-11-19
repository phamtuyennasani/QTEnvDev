import { BrewStore } from '@/store/brew'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'
import { reactiveBind } from '@/util/Index'
import XTerm, { TerminalExitError } from '@/util/XTerm'
import { markRaw, nextTick, type Ref } from 'vue'

type CatalogRow = { version: string; mVersion: string; url: string }
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)

class N8NManager {
  fetching = false
  installing = false
  installEnd = false
  stopping = false
  refreshingInstalled = false
  status = ''
  error = ''
  unknown = false
  versions: Array<CatalogRow & { installed: boolean }> = []
  xterm?: XTerm
  private cancelled = false
  private stopFlight?: Promise<unknown>

  private updateInstalledState() {
    const { installed } = BrewStore().module('n8n')
    this.versions = this.versions.map((row) => ({
      ...row,
      installed: installed.some((item) => item.version === row.version)
    }))
  }

  reinit() {
    void this.doFetch(true)
  }

  init() {
    void this.doFetch(false)
  }

  async doFetch(fresh: boolean) {
    if (this.fetching || this.installing || (!fresh && this.versions.length > 0)) return
    this.fetching = true
    this.error = ''
    try {
      const module = BrewStore().module('n8n')
      const discovered = await module.fetchInstalled(false, { fresh })
      const { code, data, msg } = await forkTerminalRequest(
        'app-fork:n8n',
        ['fetchAllOnlineVersion'],
        'The n8n catalog request timed out.',
        45_000
      )
      if (code !== 0 || !Array.isArray(data)) throw new Error(msg || 'Could not load the n8n catalog.')
      this.versions = data.map((row: CatalogRow) => ({ ...row, installed: false }))
      this.updateInstalledState()
      if (!discovered) this.error = 'Installed n8n versions could not be refreshed.'
    } catch (error) {
      this.error = errorText(error)
    } finally {
      this.fetching = false
    }
  }

  async doAction(version: string, installed: boolean, domRef: Ref<HTMLElement | undefined>) {
    if (this.installing || this.fetching || this.unknown || !/^\d+\.\d+\.\d+$/.test(version)) return
    this.status = ''
    this.error = ''
    this.cancelled = false
    this.stopFlight = undefined
    this.installing = true
    const terminal = markRaw(new XTerm())
    this.xterm = terminal
    let submitted = false
    try {
      await nextTick()
      if (domRef.value) void this.attach(domRef.value)
      await terminal.initialize()
      if (!this.cancelled) {
        submitted = true
        // The main process terminal already receives the configured proxy environment.
        const command = `npm ${installed ? 'uninstall' : 'install'} -g n8n@${version}`
        const result = await terminal.send([command], 'direct', true)
        if (result !== true) throw new Error('npm did not confirm completion.')
      }
      if (this.cancelled) {
        await this.stopTerminal()
        this.status = 'The n8n package operation was cancelled.'
      } else {
        this.status = installed ? 'npm removed n8n.' : 'npm installed n8n.'
      }
    } catch (error) {
      this.error = errorText(error)
      const knownExit = error instanceof TerminalExitError && typeof error.exitCode === 'number'
      this.unknown = submitted && !knownExit && !this.cancelled
      if (terminal.ptyKey && !knownExit) {
        try {
          await this.stopTerminal()
        } catch {
          this.unknown = true
          this.error += ' The terminal did not confirm that it stopped.'
        }
      }
    } finally {
      terminal.releaseProcessOutput()
      this.stopping = false
    }
    this.refreshingInstalled = true
    try {
      const refreshed = await BrewStore().module('n8n').fetchInstalled(false, { fresh: true })
      if (!refreshed) throw new Error('Installed n8n versions could not be refreshed.')
      this.updateInstalledState()
      window.dispatchEvent(new CustomEvent('pqt-packages-changed', { detail: 'n8n' }))
    } catch (error) {
      this.error = [this.error, errorText(error)].filter(Boolean).join(' ')
    } finally {
      this.refreshingInstalled = false
      this.installEnd = true
    }
  }

  onConfirm() {
    if (!this.installEnd) return
    this.installing = false
    this.installEnd = false
    this.xterm?.destroy()
    this.xterm = undefined
  }

  private stopTerminal() {
    this.stopFlight ??= this.xterm?.stop()
    return this.stopFlight
  }

  async onCancel() {
    if (!this.installing || this.stopping || this.refreshingInstalled || this.installEnd) return
    this.stopping = true
    this.cancelled = true
    if (!this.xterm?.ptyKey) return
    try {
      await this.stopTerminal()
    } catch (error) {
      this.stopFlight = undefined
      this.cancelled = false
      this.error = errorText(error)
    } finally {
      this.stopping = false
    }
  }

  private async attach(dom: HTMLElement) {
    try {
      await this.xterm?.mount(dom)
    } catch (error) {
      this.error = errorText(error)
    }
  }

  onMounted(domRef: Ref<HTMLElement | undefined>) {
    if (this.installing && this.xterm && domRef.value) void this.attach(domRef.value)
  }

  onUnmounted() {
    this.xterm?.unmounted()
  }
}

export const N8NManagerSetup = reactiveBind(new N8NManager())
