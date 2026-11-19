import { mirrorConfig, mirrorDefaults, mirrorUrl, type MirrorConfig } from '../../main/ui/SiteSucker/Policy'
import type { MirrorEvent, MirrorLink, MirrorSnapshot } from '../../main/ui/SiteSucker/Operation'
export type SiteSuckerDependencies = {
  request(command: string, ...args: unknown[]): Promise<any>
  subscribe(callback: (event: MirrorEvent) => void): () => void
  load(): Promise<Partial<MirrorConfig> | undefined>
  save(config: MirrorConfig): Promise<void>
  id(): string
}
export class SiteSuckerModel {
  config: MirrorConfig = { ...mirrorDefaults }
  url = ''
  links: MirrorLink[] = []
  running = false
  unknown = false
  error = ''
  warning = ''
  status = 'Idle'
  operationId = ''
  settingsReady = false
  settingsLoading = false
  private ready?: Promise<void>
  private saves = Promise.resolve()
  private unsubscribe?: () => void
  private reconciling = false
  private stopRequested = false
  constructor(private deps: SiteSuckerDependencies) {}
  init() {
    if (!this.unsubscribe) this.unsubscribe = this.deps.subscribe((event) => this.event(event))
    if (!this.ready) this.ready = this.initialize()
    return this.ready
  }
  private async initialize() {
    this.settingsLoading = true
    try {
      const saved = await this.deps.load()
      const legacy = saved ?? await this.deps.request('app-sitesucker-setup')
      this.config = mirrorConfig(legacy?.commonSetup || legacy || {})
      this.settingsReady = true
    } catch (error) { this.warning = `Settings could not be loaded: ${String(error)}`; this.ready = undefined }
    finally { this.settingsLoading = false }
    await this.reconcile()
  }
  private event(event: MirrorEvent) {
    if (!event || event.operationId !== this.operationId) return
    if (event.kind === 'link') {
      const current = this.links.find((link) => link.url === event.link.url)
      if (current) Object.assign(current, event.link); else this.links.push({ ...event.link })
    } else this.result(event.result)
  }
  private result(result: MirrorSnapshot) {
    this.operationId = result.operationId
    this.links = result.links.map((link) => ({ ...link }))
    this.running = result.state === 'running'
    this.unknown = false
    this.status = result.state[0].toUpperCase() + result.state.slice(1)
    this.error = result.state === 'failed' ? result.message || 'Mirror failed' : ''
    if (result.message && result.state !== 'failed') this.warning = result.message
  }
  async reconcile() {
    if (this.reconciling) return false
    this.reconciling = true
    try {
      const snapshot = await this.deps.request('app-sitesucker-status') as MirrorSnapshot | null
      if (snapshot) this.result(snapshot)
      else { this.running = false; this.unknown = false; this.status = this.operationId ? 'Stopped' : 'Idle' }
      return true
    } catch (error) { this.error = String(error); return false }
    finally { this.reconciling = false }
  }
  async saveConfig() {
    await this.init()
    if (!this.settingsReady) return false
    try { this.config = mirrorConfig(this.config); await this.persist({ ...this.config }); this.warning = ''; return true }
    catch (error) { this.warning = `Settings were not saved: ${String(error)}`; return false }
  }
  private persist(config: MirrorConfig) {
    const saved = this.saves.then(() => this.deps.save(config))
    this.saves = saved.catch(() => {})
    return saved
  }
  async setExcludedHost(host: string) {
    await this.init()
    if (!this.settingsReady) return false
    const excluded = new Set(this.config.excludeLink.split('\n').map((line) => line.trim()).filter(Boolean))
    if (excluded.has(host)) excluded.delete(host); else excluded.add(host)
    this.config.excludeLink = [...excluded].join('\n')
    return this.saveConfig()
  }
  async run() {
    await this.init()
    if (!this.settingsReady) return false
    if (this.running || this.unknown) return false
    let url: URL
    try {
      url = mirrorUrl(this.url.trim())
      if (!this.config.dir.trim()) throw new Error('Choose an output folder')
    } catch (error) { this.error = error instanceof Error ? error.message : String(error); return false }
    this.config = mirrorConfig(this.config)
    const snapshot = { operationId: this.deps.id(), url: url.href, config: { ...this.config } }
    this.operationId = snapshot.operationId
    this.stopRequested = false
    this.running = true; this.error = ''; this.warning = ''; this.status = 'Starting'; this.links = []
    try {
      const response = await this.deps.request('app-sitesucker-run', snapshot) as MirrorSnapshot
      // Progress/terminal can arrive before the opening acknowledgement.
      if (this.running && response?.operationId === this.operationId) this.result(response)
      try { await this.persist({ ...snapshot.config }) }
      catch (error) { this.warning = 'Settings were not saved: ' + String(error) }
      return true
    } catch (error) {
      if (this.stopRequested && !this.running && !this.unknown) { this.warning = 'Mirror start was cancelled.'; return false }
      // A native terminal fact may arrive before a lost/rejected launch ack.
      // Transport failure cannot erase already settled output.
      if (!this.running && !this.unknown && ['Completed', 'Partial', 'Cancelled', 'Failed'].includes(this.status)) {
        this.warning = 'Start acknowledgement was not received: ' + String(error)
        return true
      }
      this.error = String(error)
      if (error instanceof SiteOutcomeUnknown) { this.unknown = true; this.status = 'Outcome unknown' }
      else { this.running = false; this.status = 'Failed' }
      return false
    }
  }
  async cancel() {
    if (!this.running && !this.unknown) return false
    this.status = 'Stopping'
    this.stopRequested = true
    try {
      const result = await this.deps.request('app-sitesucker-stop') as MirrorSnapshot | null
      if (result) this.result(result)
      else { this.running = false; this.unknown = false; this.status = 'Cancelled' }
      return true
    } catch (error) { this.unknown = true; this.status = 'Outcome unknown'; this.error = String(error); return false }
  }
  dispose() { this.unsubscribe?.(); this.unsubscribe = undefined }
}
export class SiteOutcomeUnknown extends Error {}
