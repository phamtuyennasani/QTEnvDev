import { markRaw } from 'vue'
import { reactiveBind } from '@/util/Index'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'
import XTerm, { TerminalExitError } from '@/util/XTerm'
import { showNotice } from '../state/app'

type Target = { bin: string; version: string }
type Status = { installed: boolean; pgConfig: string; requiresAdministrator: boolean }
const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'"
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

export function pgvectorInstallCommand(pgConfig: string, requiresAdministrator: boolean) {
  return [
    'set -eu',
    'build_dir=$(mktemp -d /tmp/qtenvdev-pgvector.XXXXXXXX)',
    'trap \'rm -rf -- "$build_dir"\' EXIT',
    // PGXS interpolates PG_CONFIG into a shell expression. Use a fixed-path launcher.
    `printf '%s\\n' '#!/bin/sh' ${quote(`exec ${quote(pgConfig)} "$@"`)} > "$build_dir/pg_config"`,
    'chmod 700 "$build_dir/pg_config"',
    'git clone --depth 1 --branch v0.8.2 https://github.com/pgvector/pgvector.git "$build_dir/source"',
    'cd "$build_dir/source"',
    'make PG_CONFIG="$build_dir/pg_config" OPTFLAGS=',
    `${requiresAdministrator ? 'sudo -- ' : ''}make PG_CONFIG="$build_dir/pg_config" install`
  ].join('\n')
}

class PgvectorController {
  target?: Target
  status?: Status
  phase: 'idle' | 'checking' | 'installing' | 'installed' | 'failed' | 'unknown' = 'idle'
  message = ''
  terminal?: XTerm
  private view?: HTMLElement
  private flight?: Promise<boolean>

  get busy() {
    return this.phase === 'checking' || this.phase === 'installing'
  }

  get canInstall() {
    const major = Number(this.target?.version.split('.')[0])
    return Boolean(
      this.status &&
      !this.status.installed &&
      !this.busy &&
      this.phase !== 'unknown' &&
      this.supported() &&
      major >= 13
    )
  }

  supported() {
    return Boolean(window.Server?.isMacOS || window.Server?.isLinux)
  }

  check(target: Target): Promise<boolean> {
    if (this.flight) return this.flight
    const previous = this.target
    if (
      this.phase === 'unknown' &&
      (previous?.bin !== target.bin || previous?.version !== target.version)
    ) {
      return Promise.resolve(false)
    }
    const selected = { bin: target.bin, version: target.version }
    const unknown = this.phase === 'unknown'
    if (previous && (previous.bin !== selected.bin || previous.version !== selected.version)) {
      this.terminal?.destroy()
      this.terminal = undefined
    }
    this.target = selected
    this.status = undefined
    this.phase = 'checking'
    this.message = ''
    return this.track(async () => {
      try {
        this.status = await this.readStatus(selected)
        this.phase = unknown ? 'unknown' : this.status.installed ? 'installed' : 'idle'
        if (this.phase === 'unknown')
          this.message =
            'The earlier install did not report its result. Restart the app after checking the terminal.'
        return true
      } catch (error) {
        this.phase = unknown ? 'unknown' : 'failed'
        this.message = errorText(error)
        return false
      }
    })
  }

  install(): Promise<boolean> {
    if (this.flight) return this.flight
    const { status, target } = this
    if (!this.canInstall || !status || !target) return Promise.resolve(false)
    const selected = { ...target }
    const command = pgvectorInstallCommand(status.pgConfig, status.requiresAdministrator)
    this.terminal?.destroy()
    const terminal = markRaw(new XTerm())
    this.terminal = terminal
    this.phase = 'installing'
    this.message = ''
    return this.track(async () => {
      let commandCompleted = false
      try {
        await terminal.initialize()
        await terminal.send([command], true, true)
        commandCompleted = true
        this.status = await this.readStatus(selected)
        if (!this.status.installed)
          throw new Error(
            'The build finished, but PostgreSQL’s extension files could not be verified.'
          )
        this.phase = 'installed'
        this.message = 'pgvector is available for PostgreSQL ' + selected.version + '.'
      } catch (error) {
        this.phase = 'failed'
        this.message = errorText(error)
        if (commandCompleted) {
          // The install may have succeeded before verification failed. Require a fresh check.
          this.status = undefined
        } else if (
          terminal.ptyKey &&
          !(error instanceof TerminalExitError && typeof error.exitCode === 'number')
        ) {
          try {
            await terminal.stop()
          } catch {
            this.phase = 'unknown'
            this.message =
              'Installation did not report its result. Check the terminal before retrying.'
          }
        }
      } finally {
        if (this.phase !== 'unknown') terminal.releaseProcessOutput()
      }
      showNotice(this.message)
      return this.phase === 'installed'
    })
  }

  async attach(view: HTMLElement) {
    this.view = view
    try {
      await this.terminal?.mount(view)
    } catch (error) {
      if (this.view === view) showNotice(errorText(error))
    }
  }

  detach(view: HTMLElement) {
    if (this.view !== view) return
    this.view = undefined
    this.terminal?.unmounted()
  }

  private track(operation: () => Promise<boolean>) {
    const flight = Promise.resolve()
      .then(operation)
      .finally(() => {
        this.flight = undefined
      })
    this.flight = flight
    return flight
  }

  private async readStatus(target: Target): Promise<Status> {
    const result = await forkTerminalRequest(
      'app-fork:postgresql',
      ['pgvectorStatus', target],
      'Checking pgvector timed out.',
      30_000
    )
    if (result.code !== 0) throw new Error(result.msg || 'Could not verify pgvector files.')
    if (
      typeof result.data?.installed !== 'boolean' ||
      typeof result.data?.pgConfig !== 'string' ||
      !result.data.pgConfig ||
      typeof result.data?.requiresAdministrator !== 'boolean'
    ) {
      throw new Error('PostgreSQL returned incomplete pgvector information.')
    }
    return result.data
  }
}

export const pgvectorController = reactiveBind(new PgvectorController())
