export type CustomTool = { id: string; label: string; component: string }
export type ToolLibraryData = { favorites: string[]; custom: CustomTool[] }
type Dependencies = {
  load(): Promise<unknown>
  save(data: ToolLibraryData): Promise<void>
  readLegacy(): Promise<unknown>
  id(): string
  aliases: readonly string[]
  openExternal(url: string): Promise<unknown>
}
type Webview = {
  addEventListener(event: string, callback: (event: any) => void): void
  removeEventListener(event: string, callback: (event: any) => void): void
  stop(): void
  reload(): void
  getURL?(): string
}
const legacyIds: Record<string, string> = {
  SystemEnv: 'environment', 'wifi-qr-code-generator': 'wifi-qrcode', Capturer: 'capturer',
  'jwt-encoder-decoder': 'jwt', SSLMake: 'ssl-maker', BomClean: 'bom-clean', CodePlay: 'playground',
  'websocket-sse': 'websocket', SiteSucker: 'site-sucker', CodeLibrary: 'code-library',
  'base64-string-converter': 'base64', 'qr-code-generator': 'qrcode', 'url-encode': 'url',
  'chmod-calculator': 'chmod', 'rsa-key-generator': 'rsa', ProcessKill: 'process', PortKill: 'process',
  TokenGenerator: 'token', FileInfo: 'file-info', RequestTime: 'request-time',
  'base64-file-converter': 'base64-file', 'diff-compare': 'diff', Timestamp: 'timestamp',
  'escape-html': 'html', 'http-status-codes': 'http-status', EncryptDecryptText: 'encryption',
  ImageCompress: 'image-compress', HashText: 'hash', PhpObfuscator: 'php-obfuscator',
  'keycode-info': 'keycode', MarkdownPreview: 'markdown', JsonParse: 'json'
}
const message = (error: unknown) => error instanceof Error ? error.message : String(error)
export const customToolUrl = (component: string): string | undefined => {
  try {
    const url = new URL(component.trim())
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined
  } catch { return undefined }
}
const sanitize = (value: unknown, legacy = false): { data: ToolLibraryData; skipped: number } => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const custom: CustomTool[] = []; const ids = new Set<string>(); let skipped = 0
  for (const candidate of Array.isArray(source.custom) ? source.custom : []) {
    if (!candidate || typeof candidate !== 'object' || typeof candidate.id !== 'string' || !candidate.id ||
      typeof candidate.label !== 'string' || !candidate.label.trim() ||
      typeof candidate.component !== 'string' || !candidate.component.trim() || ids.has(candidate.id)) { skipped++; continue }
    ids.add(candidate.id)
    custom.push({ id: candidate.id, label: candidate.label.trim(), component: candidate.component.trim() })
  }
  const likes = legacy ? source.like : source.favorites
  const favorites = [...new Set((Array.isArray(likes) ? likes : []).filter((id): id is string => typeof id === 'string' && Boolean(id)).map((id) => legacy && !ids.has(id) ? legacyIds[id] ?? id : id))]
  return { data: { custom, favorites }, skipped }
}
const snapshot = (data: ToolLibraryData): ToolLibraryData => ({ favorites: [...data.favorites], custom: data.custom.map((item) => ({ ...item })) })

export class ToolLibraryController {
  favorites: string[] = []
  custom: CustomTool[] = []
  ready = false
  error = ''
  warning = ''
  saving = 0
  opened?: CustomTool
  pageStatus: 'idle' | 'loading' | 'ready' | 'failed' = 'idle'
  pageError = ''
  externalError = ''
  private initializing?: Promise<boolean>
  private writes: Promise<unknown> = Promise.resolve()
  private view?: Webview
  private listeners: Array<[string, (event: any) => void]> = []
  constructor(private deps: Dependencies) {}

  init(): Promise<boolean> {
    if (this.ready) return Promise.resolve(true)
    if (this.initializing) return this.initializing
    this.initializing = Promise.resolve().then(async () => {
      try {
        const saved = await this.deps.load()
        let result = sanitize(saved)
        if (saved === undefined) {
          const legacy = await this.deps.readLegacy()
          result = sanitize(legacy, true)
          if (legacy !== undefined) await this.deps.save(snapshot(result.data))
        }
        this.custom = result.data.custom; this.favorites = result.data.favorites
        this.warning = result.skipped ? String(result.skipped) + ' invalid or duplicate custom tools were skipped.' : ''
        this.ready = true; this.error = ''
        return true
      } catch (error) { this.error = message(error); return false }
      finally { this.initializing = undefined }
    })
    return this.initializing
  }

  isFavorite(id: string) { return this.favorites.includes(id) }
  private mutate(change: (data: ToolLibraryData) => void): Promise<boolean> {
    this.saving++
    const operation = this.writes.then(async () => {
      if (!await this.init()) return false
      try {
        const next = snapshot(this)
        change(next)
        await this.deps.save(snapshot(next))
        this.custom = next.custom; this.favorites = next.favorites; this.error = ''
        return true
      } catch (error) { this.error = message(error); return false }
    }).finally(() => { this.saving-- })
    this.writes = operation
    return operation
  }
  toggleFavorite(id: string) {
    return this.mutate((data) => {
      if (!this.deps.aliases.includes(id) && !data.custom.some((item) => item.id === id)) throw new Error('Tool was not found')
      data.favorites = data.favorites.includes(id) ? data.favorites.filter((item) => item !== id) : [...data.favorites, id]
    })
  }
  private validate(label: string, component: string) {
    const cleanLabel = label.trim(); const cleanComponent = component.trim()
    if (!cleanLabel || !cleanComponent) throw new Error('Label and URL are required')
    if (!customToolUrl(cleanComponent) && !this.deps.aliases.includes(cleanComponent)) throw new Error('Enter an HTTP or HTTPS URL')
    return { label: cleanLabel, component: customToolUrl(cleanComponent) ?? cleanComponent }
  }
  addCustom(label: string, component: string) {
    return this.mutate((data) => { const clean = this.validate(label, component); data.custom.unshift({ id: 'custom-' + this.deps.id(), ...clean }) })
  }
  updateCustom(id: string, label: string, component: string) {
    return this.mutate((data) => {
      const clean = this.validate(label, component)
      const item = data.custom.find((entry) => entry.id === id)
      if (!item) throw new Error('Custom tool was not found')
      Object.assign(item, clean)
    })
  }
  removeCustom(id: string) {
    return this.mutate((data) => {
      data.custom = data.custom.filter((item) => item.id !== id)
      data.favorites = data.favorites.filter((item) => item !== id)
    }).then((ok) => { if (ok && this.opened?.id === id) this.close(); return ok })
  }
  open(item: CustomTool): boolean {
    const url = customToolUrl(item.component)
    if (!url) { this.error = 'This custom tool URL is unavailable. Edit it to enter an HTTP or HTTPS URL.'; return false }
    this.close()
    this.opened = { ...item, component: url }; this.pageStatus = 'loading'; this.pageError = ''; this.externalError = ''
    return true
  }
  attach(view: Webview) {
    this.detach()
    this.view = view
    const on = (name: string, callback: (event: any) => void) => { this.listeners.push([name, callback]); view.addEventListener(name, callback) }
    on('did-start-loading', () => { this.pageStatus = 'loading'; this.pageError = '' })
    on('did-finish-load', () => { if (this.pageStatus !== 'failed') this.pageStatus = 'ready' })
    on('did-fail-load', (event) => { if (event.isMainFrame === false || event.errorCode === -3) return; this.pageStatus = 'failed'; this.pageError = event.errorDescription || 'The custom tool could not load.' })
  }
  detach() {
    if (this.view) { for (const [name, callback] of this.listeners) this.view.removeEventListener(name, callback); try { this.view.stop() } catch { /* The guest may already be destroyed. */ } }
    this.listeners = []; this.view = undefined
  }
  close() { this.detach(); this.opened = undefined; this.pageStatus = 'idle'; this.pageError = ''; this.externalError = '' }
  reload() { try { this.view?.reload() } catch (error) { this.pageError = message(error); this.pageStatus = 'failed' } }
  async openExternal() {
    const url = customToolUrl(this.view?.getURL?.() || this.opened?.component || '')
    if (!url) return false
    try { await this.deps.openExternal(url); this.externalError = ''; return true }
    catch (error) { this.externalError = message(error); return false }
  }
}
