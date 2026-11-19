import { validateCapturerName, type CapturerConfig, type CapturerEvent } from '../../shared/CapturerContract'
export type { CapturerConfig, CapturerEvent }
type Dependencies = {
  load(): Promise<unknown>
  legacy(): Promise<unknown>
  save(config: CapturerConfig): Promise<void>
  request(command: string, ...args: unknown[]): Promise<any>
  subscribe(callback: (event: CapturerEvent) => void): () => void
  id(): string
  now(): number
  active(): boolean
}
const defaults = (): CapturerConfig => ({ key: [], dir: '', name: 'qtenvdev-capturer-{timestamp}', trialStartTime: 0 })
const parse = (value: unknown): CapturerConfig => {
  const item = value && typeof value === 'object' ? value as Partial<CapturerConfig> : {}
  return { key: Array.isArray(item.key) ? item.key.filter((key) => typeof key === 'string') : [], dir: typeof item.dir === 'string' ? item.dir : '', name: typeof item.name === 'string' ? item.name : defaults().name, trialStartTime: Number.isFinite(item.trialStartTime) && Number(item.trialStartTime) > 0 ? Number(item.trialStartTime) : 0 }
}
export class CapturerOutcomeUnknown extends Error {}
export class CapturerOperation {
  config = defaults()
  running = false
  saving = false
  ready = false
  error = ''
  warning = ''
  status = 'Idle'
  outcome: CapturerEvent['status'] | 'unknown' = 'idle'
  path = ''
  private operationId = ''
  private disposeListener?: () => void
  private initializing?: Promise<boolean>
  private launch?: Promise<boolean>
  private launchEpoch = 0
  constructor(private deps: Dependencies) {}
  init() {
    if (!this.disposeListener) this.disposeListener = this.deps.subscribe((event) => this.receive(event))
    if (this.ready) return Promise.resolve(true)
    if (this.initializing) return this.initializing
    this.initializing = Promise.resolve().then(async () => {
      try {
        const saved = await this.deps.load()
        const legacy = await this.deps.legacy()
        this.config = parse(saved === undefined ? legacy : saved)
        const oldTrial = parse(legacy).trialStartTime
        if (oldTrial && (!this.config.trialStartTime || oldTrial < this.config.trialStartTime)) this.config.trialStartTime = oldTrial
        if (saved === undefined || oldTrial && this.config.trialStartTime !== parse(saved).trialStartTime) await this.deps.save({ ...this.config, key: [...this.config.key] })
        this.error = ''
        if (this.deps.active() || !this.config.trialStartTime || this.config.trialStartTime + 3 * 86400 >= this.deps.now()) {
          try { await this.deps.request('Capturer:Config-Update', this.snapshot(this.config)) }
          catch (error) { this.warning = 'Saved capture settings could not be applied: ' + String(error) }
        }
        await this.reconcile()
        this.ready = true
        return true
      } catch (error) { this.error = error instanceof Error ? error.message : String(error); return false }
      finally { this.initializing = undefined }
    })
    return this.initializing
  }
  private snapshot(config: CapturerConfig) {
    validateCapturerName(config.name)
    const keys = config.key.map((key) => key.trim()).filter(Boolean)
    if (keys.some((key) => key.includes('+') || key.length > 30) || keys.length > 5) throw new Error('Shortcut must contain a supported key combination.')
    if (keys.join('+').toLowerCase() === 'escape') throw new Error('Escape is reserved for cancelling the capture.')
    return { ...config, key: keys }
  }
  async saveConfig(config?: CapturerConfig) {
    if (this.saving || this.running) return false
    this.saving = true
    try {
      const requested = config ? this.snapshot(config) : undefined
      if (!this.ready && !await this.init()) throw new Error(this.error || 'Capture settings could not be loaded.')
      const next = requested ?? this.snapshot(this.config)
      next.trialStartTime = this.config.trialStartTime
      if (!this.deps.active() && next.trialStartTime > 0 && next.trialStartTime + 3 * 86400 < this.deps.now()) throw new Error('The capturer trial has ended.')
      await this.deps.request('Capturer:Config-Update', next)
      try { await this.deps.save(next) } catch (error) { this.warning = 'Native configuration applied, but settings could not be saved: ' + String(error); return false }
      this.config = next; this.error = ''; this.status = 'Configuration saved'
      return true
    } catch (error) { this.error = error instanceof Error ? error.message : String(error); return false }
    finally { this.saving = false }
  }
  capture(hideWindow = false, config?: CapturerConfig): Promise<boolean> {
    if (this.launch) return this.launch
    if (this.saving || this.running || this.outcome === 'unknown') return Promise.resolve(false)
    const requestedConfig = config ? { ...config, key: [...config.key] } : undefined
    const epoch = ++this.launchEpoch
    this.running = true; this.error = ''; this.warning = ''; this.path = ''; this.status = 'Opening capture'; this.outcome = 'opening'
    this.launch = Promise.resolve().then(async () => {
      try {
        if (!this.ready && !await this.init()) throw new Error(this.error)
        if (epoch !== this.launchEpoch) return false
        this.running = true; this.outcome = 'opening'; this.status = 'Opening capture'
        const next = this.snapshot(requestedConfig ?? this.config); next.trialStartTime = this.config.trialStartTime
        if (!this.deps.active()) {
          if (next.trialStartTime > 0 && next.trialStartTime + 3 * 86400 < this.deps.now()) throw new Error('The capturer trial has ended.')
          if (!next.trialStartTime) { next.trialStartTime = this.deps.now(); await this.deps.save(next); this.config.trialStartTime = next.trialStartTime }
        }
        this.operationId = this.deps.id()
        await this.deps.request('Capturer:Config-Update', next)
        if (epoch !== this.launchEpoch) return false
        this.config = next
        const ack = await this.deps.request('Capturer:doCapturer', hideWindow, this.operationId)
        if (epoch === this.launchEpoch && ack?.status) this.receive(ack)
        return true
      } catch (error) {
        if (epoch !== this.launchEpoch) return false
        if (error instanceof CapturerOutcomeUnknown) { this.outcome = 'unknown'; this.status = 'Capture outcome unknown'; this.running = true }
        else { this.outcome = 'failed'; this.status = 'Capture failed'; this.running = false }
        this.error = error instanceof Error ? error.message : String(error)
        return false
      } finally { this.launch = undefined }
    })
    return this.launch
  }
  receive(event: CapturerEvent) {
    if (!event?.id || this.operationId && event.id !== this.operationId) return
    this.operationId = event.id; this.outcome = event.status; this.status = event.status === 'saved' ? 'Screenshot saved' : event.status === 'cancelled' ? 'Capture cancelled' : event.status === 'failed' ? 'Capture failed' : event.status === 'saving' ? 'Saving screenshot' : 'Capture window opened'
    this.running = ['opening', 'opened', 'saving'].includes(event.status)
    this.path = event.path ?? this.path; this.error = event.error ?? ''; this.warning = event.warning ?? this.warning
  }
  async cancel() {
    this.launchEpoch += 1
    try { const event = await this.deps.request('Capturer:doStopCapturer'); if (event?.id) this.receive(event); else await this.reconcile(); return !this.running }
    catch (error) { this.outcome = 'unknown'; this.status = 'Capture outcome unknown'; this.running = true; this.error = String(error); return false }
  }
  async reconcile() {
    try {
      const event = await this.deps.request('Capturer:status')
      if (event?.status === 'idle') { this.running = false; this.outcome = 'idle'; this.status = 'Idle'; this.operationId = ''; this.error = '' }
      else if (event?.id) { this.operationId = event.id; this.receive(event) }
      return true
    } catch (error) { this.warning = 'Native capture status could not be read: ' + String(error); return false }
  }
  dispose() { this.disposeListener?.(); this.disposeListener = undefined }
}
