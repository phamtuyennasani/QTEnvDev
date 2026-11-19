import { markRaw } from 'vue'
import IPC from '@/util/IPC'
import { reactiveBind } from '@/util/Index'
import XTerm, { TerminalExitError } from '@/util/XTerm'
import { packageRequest } from '../packages/transport'
import { packageError } from '../packages/types'

const installers = {
  winget: {
    label: 'WinGet',
    command:
      'winget.exe install --id Git.Git --exact --source winget --accept-source-agreements --accept-package-agreements'
  },
  xcode: { label: 'Apple Command Line Tools', command: '/usr/bin/xcode-select --install' },
  system: {
    label: 'System package manager',
    command: [
      'if command -v apt-get >/dev/null 2>&1; then sudo apt-get update && sudo apt-get install -y git',
      'elif command -v dnf >/dev/null 2>&1; then sudo dnf install -y git',
      'elif command -v yum >/dev/null 2>&1; then sudo yum install -y git',
      'elif command -v pacman >/dev/null 2>&1; then sudo pacman -S --needed --noconfirm git',
      'else printf "%s\\n" "No supported package manager was found." >&2; exit 1; fi'
    ].join('; ')
  },
  brew: { label: 'Homebrew', command: 'brew install git' },
  port: { label: 'MacPorts', command: 'sudo /opt/local/bin/port install git' }
} as const

export type GitInstaller = keyof typeof installers
type Phase =
  | 'idle'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'succeeded'
  | 'requested'
  | 'failed'
  | 'cancelled'
  | 'unknown'
type GitCheck = { label: string; ok: boolean; value: string; message: string }

class GitEnvironmentController {
  installed?: boolean
  items: GitCheck[] = []
  version = ''
  loading = false
  phase: Phase = 'idle'
  discoveryError = ''
  error = ''
  terminalError = ''

  private terminal?: XTerm
  private flight?: Promise<void>
  private stopping?: Promise<unknown>
  private cancelled = false

  get methods() {
    const server = window.Server
    const methods: GitInstaller[] = []
    if (server.isWindows) methods.push('winget')
    if (server.isMacOS) methods.push('xcode')
    if (server.isLinux) methods.push('system')
    if ((server.isMacOS || server.isLinux) && server.BrewCellar) methods.push('brew')
    if (server.isMacOS && server.MacPorts) methods.push('port')
    return methods.map((id) => ({ id, label: installers[id].label }))
  }

  get busy() {
    return Boolean(this.flight)
  }
  get canCancel() {
    return this.phase === 'starting' || this.phase === 'running'
  }
  get showTerminal() {
    return Boolean(this.terminal)
  }
  get canInstall() {
    return Boolean(
      window.QTEnvDevNodeAPI &&
      this.installed === false &&
      !this.loading &&
      !this.busy &&
      !this.discoveryError &&
      !['unknown', 'succeeded', 'requested'].includes(this.phase)
    )
  }

  async refresh() {
    if (this.loading || this.busy) return
    await this.detect()
  }

  private async detect() {
    this.loading = true
    this.discoveryError = ''
    try {
      const result = (await packageRequest(IPC, 'app-fork:git', ['checkInstalled'], {
        timeout: 30_000
      })) as { installed?: unknown; version?: string } | undefined
      if (typeof result?.installed !== 'boolean')
        throw new Error('Git detection returned no result.')
      this.installed = result.installed
      this.version = result.installed ? (result.version ?? '') : ''
      this.items = []
      if (result.installed) {
        const data = (await packageRequest(IPC, 'app-fork:git', ['check'], { timeout: 30_000 })) as
          { items?: GitCheck[] } | undefined
        if (!Array.isArray(data?.items)) throw new Error('Git diagnostics returned no result.')
        this.items = data.items
      }
    } catch (error) {
      this.discoveryError = packageError(error)
    } finally {
      this.loading = false
    }
  }

  start(method: GitInstaller) {
    if (this.flight) return this.flight
    if (!this.canInstall || !this.methods.some(({ id }) => id === method)) return
    this.terminal?.destroy()
    this.terminal = markRaw(new XTerm())
    const terminal = this.terminal
    this.cancelled = false
    this.stopping = undefined
    this.error = ''
    this.terminalError = ''
    this.phase = 'starting'
    this.flight = this.run(terminal, method).finally(() => {
      this.flight = undefined
    })
    return this.flight
  }

  private async run(terminal: XTerm, method: GitInstaller) {
    let submitted = false
    try {
      await terminal.initialize()
      if (!this.cancelled) {
        this.phase = 'running'
        submitted = true
        const result = await terminal.send([installers[method].command], 'direct', true)
        if (result !== true) throw new Error('The terminal did not report an installation result.')
      }
      if (this.cancelled) {
        await this.stopTerminal(terminal)
        this.phase = 'cancelled'
      } else {
        this.phase = method === 'xcode' ? 'requested' : 'succeeded'
      }
    } catch (error) {
      const exited = error instanceof TerminalExitError && typeof error.exitCode === 'number'
      let outcomeUncertain = submitted && !exited
      if (terminal.ptyKey && !exited) {
        try {
          await this.stopTerminal(terminal)
        } catch (stopError) {
          outcomeUncertain = true
          this.terminalError = 'The terminal could not be stopped. ' + packageError(stopError)
        }
      }
      this.phase = outcomeUncertain ? 'unknown' : 'failed'
      this.error = packageError(error)
    } finally {
      terminal.releaseProcessOutput()
    }
    // Discovery can fail independently after the installer reports its final status.
    await this.detect()
  }

  private stopTerminal(terminal: XTerm) {
    this.stopping ??= terminal.stop()
    return this.stopping
  }

  async cancel() {
    if (!this.canCancel) return
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
      }
    }
  }

  async attach(element: HTMLElement) {
    const terminal = this.terminal
    if (!terminal || terminal.dom === element) return
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
}

export const gitEnvironment = reactiveBind(new GitEnvironmentController())
