import { reactiveBind } from '@/util/Index'
import IPC from '@/util/IPC'
import { clipboard, dialog, shell } from '@/util/NodeFn'
import { showNotice } from '../state/app'

type Action = 'add' | 'remove' | 'start' | 'stop'
type Server = { path: string; port: number; host: string[] }
type Snapshot = { folders: string[]; active: Server[] }

class RequestTimeout extends Error {}

function request<T>(action: Action | 'list', path?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const command = IPC.send('app-http-serve-manage', action, path)
    const timer = window.setTimeout(() => {
      IPC.off(command.key)
      reject(new RequestTimeout('HTTP Serve did not respond. Refresh to check the outcome.'))
    }, 15_000)
    command.then((key, reply) => {
      window.clearTimeout(timer)
      IPC.off(key)
      if (reply?.code === 0) resolve(reply.data)
      else reject(new Error(reply?.msg || 'HTTP Serve could not complete the request.'))
    })
  })
}

class HttpServeController {
  folders: string[] = []
  active: Server[] = []
  busy = false
  verified = false
  error = ''
  warning = ''

  get available() {
    return Boolean(window.QTEnvDevNodeAPI)
  }

  async refresh() {
    if (this.busy || !this.available) return
    this.busy = true
    this.error = ''
    try {
      await this.read()
    } catch (error) {
      this.error = this.message(error)
    } finally {
      this.busy = false
    }
  }

  async choose() {
    if (this.busy || !this.verified) return
    this.busy = true
    this.error = ''
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory', 'multiSelections']
      })
      if (!canceled) await this.apply('add', filePaths)
    } catch (error) {
      this.error = this.message(error)
    } finally {
      this.busy = false
    }
  }

  async change(action: Action, ...paths: string[]) {
    if (this.busy || !this.verified || !paths.length) return
    this.busy = true
    try {
      await this.apply(action, paths)
    } finally {
      this.busy = false
    }
  }

  async useLink(action: 'open' | 'copy', url: string) {
    try {
      if (action === 'open') await shell.openExternal(url)
      else {
        await clipboard.writeText(url)
        showNotice('Link copied.')
      }
    } catch (error) {
      showNotice(this.message(error))
    }
  }

  async reveal(path: string) {
    try {
      const error = await shell.openPath(path)
      if (error) showNotice(error)
    } catch (error) {
      showNotice(this.message(error))
    }
  }

  private async read() {
    this.verified = false
    const result = await request<Snapshot>('list')
    this.folders = result.folders
    this.active = result.active
    this.verified = true
  }

  private async apply(action: Action, paths: string[]) {
    const errors: string[] = []
    const warnings: string[] = []
    this.error = ''
    this.warning = ''
    const candidates = [...new Set(paths)]
    for (const [index, path] of candidates.entries()) {
      try {
        const result = await request<{ warning?: string }>(action, path)
        if (result.warning) warnings.push(path + ' — ' + result.warning)
      } catch (error) {
        errors.push(path + ' — ' + this.message(error))
        if (error instanceof RequestTimeout) {
          this.verified = false
          if (index + 1 < candidates.length)
            warnings.push('Remaining folders were skipped. Refresh before trying again.')
          break
        }
      }
    }
    if (this.verified) {
      try {
        await this.read()
      } catch (error) {
        warnings.push('Could not reload HTTP Serve. ' + this.message(error))
      }
    }
    this.error = errors.join('\n')
    this.warning = warnings.join('\n')
  }

  private message(error: unknown) {
    return error instanceof Error ? error.message : String(error)
  }
}

export const httpServe = reactiveBind(new HttpServeController())
