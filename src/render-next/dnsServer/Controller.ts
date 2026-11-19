export type DnsStatus = { running: boolean; address: string; localIP: string }
export type DnsConfig = { path: string; content: string; defaults: string }
export type DnsInterface = { ip: string; name: string }
type DnsLog = { id: number; host: string; ip: string; ttl: number }
type Action = 'refresh' | 'start' | 'stop' | 'restart' | 'save'

type Dependencies = {
  request: (method: string, ...args: unknown[]) => Promise<unknown>
  interfaces: () => Promise<DnsInterface[]>
  watchSites: (update: (names: string[]) => void) => () => void
  watchLog: (update: (entry: unknown) => void) => () => void
  reveal: (path: string) => Promise<unknown>
}

export class DnsServerController {
  status?: DnsStatus
  config?: DnsConfig
  interfaces: DnsInterface[] = []
  logs: DnsLog[] = []
  busy?: Action
  error = ''
  notice = ''
  syncError = ''
  private sequence = 0
  private detachSites?: () => void
  private detachLog?: () => void
  private pendingSites?: string[]
  private syncing = false

  constructor(private readonly dependencies: Dependencies) {}

  refresh() {
    return this.run('refresh', async () => {
      const [status, config, interfaces] = await Promise.allSettled([
        this.readStatus(),
        this.readConfig(),
        this.dependencies.interfaces()
      ])
      this.status = status.status === 'fulfilled' ? status.value : undefined
      this.config = config.status === 'fulfilled' ? config.value : undefined
      if (interfaces.status === 'fulfilled') this.interfaces = interfaces.value
      this.updateSubscriptions()
      const failures = [status, config, interfaces].flatMap((result) =>
        result.status === 'rejected' ? [String(result.reason)] : []
      )
      if (failures.length) this.error = failures.join('\n')
      return status.status === 'fulfilled' && config.status === 'fulfilled'
    })
  }

  change(action: 'start' | 'stop' | 'restart') {
    if (!this.status || (action === 'start') === this.status.running) return Promise.resolve(false)
    return this.run(action, async () => {
      this.status = undefined
      try {
        if (action !== 'start') await this.dependencies.request('stopService')
        if (action !== 'stop') await this.dependencies.request('startService')
        this.status = await this.readStatus()
        if (this.status.running !== (action !== 'stop')) {
          throw new Error('The DNS server did not reach the requested state.')
        }
        this.notice =
          action === 'stop' ? 'DNS server stopped.' : 'DNS server listening on UDP port 53.'
        return true
      } catch (error) {
        this.status = await this.readStatus().catch(() => undefined)
        throw error
      } finally {
        this.updateSubscriptions()
      }
    })
  }

  save(content: string, expected: string) {
    if (!this.config || this.config.content !== expected) return Promise.resolve(false)
    return this.run('save', async () => {
      const reply = await this.dependencies.request('saveWorkspaceConfig', expected, content)
      if ((reply as { content?: unknown })?.content !== content || !this.config) {
        this.config = undefined
        throw new Error('The save result could not be verified. Refresh before editing again.')
      }
      this.config = { ...this.config, content }
      this.notice = this.status?.running
        ? 'Settings saved. Restart the DNS server to apply them.'
        : 'DNS settings saved.'
      return true
    })
  }

  clearLogs() {
    this.logs = []
  }

  async reveal() {
    if (!this.config) return
    try {
      await this.dependencies.reveal(this.config.path)
    } catch (error) {
      this.error = String(error)
    }
  }

  private async run(action: Action, task: () => Promise<boolean>) {
    if (this.busy) return false
    this.busy = action
    this.error = ''
    this.notice = ''
    try {
      return await task()
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      return false
    } finally {
      this.busy = undefined
    }
  }

  private async readStatus() {
    const status = (await this.dependencies.request('workspaceStatus')) as DnsStatus | undefined
    if (
      !status ||
      typeof status.running !== 'boolean' ||
      typeof status.address !== 'string' ||
      typeof status.localIP !== 'string'
    )
      throw new Error('DNS status was not reported.')
    return status
  }

  private async readConfig() {
    const config = (await this.dependencies.request('workspaceConfig')) as DnsConfig | undefined
    if (
      !config ||
      typeof config.path !== 'string' ||
      typeof config.content !== 'string' ||
      typeof config.defaults !== 'string'
    )
      throw new Error('DNS settings were not reported.')
    return config
  }

  private updateSubscriptions() {
    if (this.status?.running) {
      this.detachLog ??= this.dependencies.watchLog((entry) => this.addLog(entry))
      this.detachSites ??= this.dependencies.watchSites((names) => {
        this.pendingSites = names
        void this.syncSites()
      })
      return
    }
    if (this.status) {
      this.detachSites?.()
      this.detachLog?.()
      this.detachSites = undefined
      this.detachLog = undefined
      this.pendingSites = undefined
      this.syncError = ''
    }
  }

  private addLog(entry: unknown) {
    const row = entry as Omit<DnsLog, 'id'> | undefined
    if (typeof row?.host !== 'string' || typeof row.ip !== 'string' || !Number.isFinite(row.ttl))
      return
    this.logs.unshift({ id: ++this.sequence, host: row.host, ip: row.ip, ttl: row.ttl })
    if (this.logs.length > 1000) this.logs.pop()
  }

  private async syncSites() {
    if (this.syncing) return
    this.syncing = true
    try {
      while (this.pendingSites) {
        const names = this.pendingSites
        this.pendingSites = undefined
        try {
          if ((await this.dependencies.request('initAppHosts', names)) !== true) {
            throw new Error('The DNS fork did not confirm the update.')
          }
          this.syncError = ''
        } catch (error) {
          if (this.status?.running) this.syncError = 'Website aliases: ' + String(error)
        }
      }
    } finally {
      this.syncing = false
    }
  }
}
