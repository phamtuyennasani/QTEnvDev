import { markRaw } from 'vue'
import IPC from '@/util/IPC'
import { reactiveBind } from '@/util/Index'
import { join } from '@/util/path-browserify'
import XTerm, { TerminalExitError } from '@/util/XTerm'
import { AppStore } from '@/store/app'
import { packageRequest } from '../packages/transport'
import { packageError } from '../packages/types'

type BootstrapPhase =
  'idle' | 'starting' | 'running' | 'stopping' | 'detecting' | 'succeeded' | 'failed' | 'cancelled'

// The bundled macOS scripts use this code when their own prompt is declined.
const installerDeclined = 125

class HomebrewBootstrapController {
  phase: BootstrapPhase = 'idle'
  error = ''
  discoveryError = ''
  terminalError = ''

  private terminal?: XTerm
  private flight?: Promise<void>
  private stopping?: Promise<unknown>
  private cancelled = false

  get permitted() {
    return Boolean(window.Server.isMacOS && window.QTEnvDevNodeAPI)
  }

  get busy() {
    return Boolean(this.flight)
  }

  get showTerminal() {
    return Boolean(this.terminal && this.phase !== 'succeeded')
  }

  get canStop() {
    return this.phase === 'starting' || this.phase === 'running'
  }

  start(): Promise<void> | undefined {
    if (this.flight) return this.flight
    if (
      !this.permitted ||
      (window.Server.BrewBin && window.Server.BrewCellar) ||
      this.discoveryError
    )
      return
    const root = window.Server.Static
    if (!root) {
      this.phase = 'failed'
      this.error = 'The bundled Homebrew installer could not be located.'
      return
    }
    const script = AppStore().config.setup.lang === 'zh' ? 'brew-install.sh' : 'brew-install-en.sh'
    // The shell can only read real files. The macOS packager unpacks these two scripts.
    const installer = join(root, 'sh', script).replace(
      /\/app\.asar(?=\/dist\/electron\/static\/)/,
      '/app.asar.unpacked'
    )
    const command = "exec /bin/zsh -f '" + installer.replace(/'/g, "'\\''") + "'"
    this.terminal?.destroy()
    this.terminal = markRaw(new XTerm())
    this.cancelled = false
    this.stopping = undefined
    this.phase = 'starting'
    this.error = ''
    this.terminalError = ''
    const terminal = this.terminal
    return this.track(() => this.run(command, terminal))
  }

  private track(work: () => Promise<void>) {
    this.flight = Promise.resolve()
      .then(work)
      .finally(() => {
        this.flight = undefined
      })
    return this.flight
  }

  private async run(command: string, terminal: XTerm) {
    try {
      await terminal.initialize()
      if (this.cancelled) {
        await this.stopTerminal(terminal)
        this.phase = 'cancelled'
        return
      }
      this.phase = 'running'
      await terminal.send([command], 'direct', true)
      if (this.cancelled) {
        await this.stopTerminal(terminal)
        this.phase = 'cancelled'
        return
      }
      terminal.releaseProcessOutput()
      await this.discover()
    } catch (error) {
      const hasTerminalExit =
        error instanceof TerminalExitError && typeof error.exitCode === 'number'
      if (terminal.ptyKey && (!hasTerminalExit || this.cancelled)) {
        try {
          await this.stopTerminal(terminal)
        } catch (stopError) {
          this.terminalError = 'The terminal could not be stopped. ' + packageError(stopError)
        }
      }
      if (
        (this.cancelled && !this.terminalError) ||
        (error instanceof TerminalExitError && error.exitCode === installerDeclined)
      ) {
        this.phase = 'cancelled'
      } else {
        this.phase = 'failed'
        this.error = packageError(error)
      }
    } finally {
      terminal.releaseProcessOutput()
    }
  }

  private stopTerminal(terminal: XTerm) {
    this.stopping ??= terminal.stop()
    return this.stopping
  }

  async cancel() {
    if (!this.canStop) return
    this.cancelled = true
    this.phase = 'stopping'
    if (this.terminal?.ptyKey) {
      try {
        await this.stopTerminal(this.terminal)
      } catch (error) {
        if (this.phase === 'stopping') {
          this.stopping = undefined
          this.cancelled = false
          this.phase = 'running'
          this.terminalError = 'The installer could not be stopped. ' + packageError(error)
        }
        return
      }
    }
    await this.flight
  }

  retryDiscovery() {
    if (!this.permitted || this.flight || !this.discoveryError) return
    return this.track(() => this.discover())
  }

  private async discover() {
    this.phase = 'detecting'
    this.discoveryError = ''
    try {
      const location = (await packageRequest(IPC, 'app-refresh-macos-homebrew', [], {
        timeout: 75_000
      })) as { bin?: string; cellar?: string } | undefined
      if (!location?.bin || !location.cellar) throw new Error('Homebrew was not detected.')
      window.Server.BrewBin = location.bin
      window.Server.BrewCellar = location.cellar
      delete window.Server.BrewError
    } catch (error) {
      this.discoveryError = packageError(error)
    } finally {
      this.phase = 'succeeded'
    }
  }

  async attach(element: HTMLElement) {
    const terminal = this.terminal
    if (!terminal || terminal.dom === element) return
    try {
      await terminal.mount(element)
      if (terminal.dom === element) this.terminalError = ''
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
}

export const homebrewBootstrap = reactiveBind(new HomebrewBootstrapController())
