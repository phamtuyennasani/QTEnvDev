import { BrowserWindow, type Session } from 'electron'
import request from '@shared/request'
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent'
import type { MirrorAdapter } from './Operation'
import { mirrorUrl, type MirrorConfig } from './Policy'

const MB = 1024 * 1024
/** Proxy, browser sessions, abort handles and byte budgets are isolated to one run. */
export class MirrorBrowserAdapter implements MirrorAdapter {
  private windows = new Set<BrowserWindow>()
  private networkBytes = 0
  private requests = 0
  private deliberateClose = false
  private session?: Session
  private policies = new Map<number, (url: string, type: string) => boolean>()
  private streams = new Set<{ destroy(error?: Error): void }>()
  constructor(private id: string, private onWindowClose: () => void) {}
  private charge(bytes: number, config: MirrorConfig) {
    this.networkBytes += bytes
    if (this.networkBytes > config.maxTotalSize * MB) throw new Error('Total network byte limit reached')
  }
  async page(url: string, config: MirrorConfig, signal: AbortSignal, resource: (url: string, type: string) => boolean) {
    if (signal.aborted) throw new Error('Cancelled')
    const window = new BrowserWindow({ show: true, width: 1280, height: 800, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, partition: `mirror-${this.id}` } })
    this.windows.add(window)
    this.session = window.webContents.session
    const contentsId = window.webContents.id
    this.policies.set(contentsId, resource)
    let closing = false
    let error: Error | undefined
    const stop = (reason: Error) => { error = reason; closing = true; if (!window.isDestroyed()) window.destroy() }
    const aborted = () => stop(new Error('Cancelled'))
    const timer = setTimeout(() => stop(new Error('Page timeout')), config.timeout)
    signal.addEventListener('abort', aborted, { once: true })
    window.once('closed', () => {
      this.windows.delete(window)
      if (!closing && !this.deliberateClose) this.onWindowClose()
    })
    try {
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      window.webContents.on('will-attach-webview', (event) => event.preventDefault())
      window.webContents.on('will-navigate', (event, target) => { try { mirrorUrl(target) } catch { event.preventDefault() } })
      await window.webContents.session.setProxy({ proxyRules: config.proxy })
      if (this.policies.size === 1) window.webContents.session.on('will-download', (event) => event.preventDefault())
      window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
        this.requests += 1
        let allowed = !signal.aborted && this.requests <= config.maxFiles + config.maxPages
        const policy = this.policies.get(details.webContentsId ?? -1)
        try { mirrorUrl(details.url); allowed = allowed && Boolean(policy?.(details.url, '')) } catch { allowed = false }
        callback({ cancel: !allowed })
      })
      window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        const headers = details.responseHeaders || {}
        const type = Object.entries(headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1]?.[0] || ''
        const policy = this.policies.get(details.webContentsId ?? -1)
        const allowed = !signal.aborted && Boolean(policy?.(details.url, type))
        const length = Number(Object.entries(headers).find(([name]) => name.toLowerCase() === 'content-length')?.[1]?.[0] || 0)
        const max = type.includes('text/html') ? Math.min(config.maxFileSize, 20) : config.maxFileSize
        // Media is saved through the bounded stream path; do not buffer it in Chromium too.
        callback({ cancel: !allowed || length > max * MB || /^(image|audio|video)\//.test(type) })
      })
      const sizes = new Map<string, number>()
      const types = new Map<string, string>()
      window.webContents.debugger.attach('1.3')
      await window.webContents.debugger.sendCommand('Network.enable')
      window.webContents.debugger.on('message', (_event, method: string, params: any) => {
        if (error || signal.aborted) return
        try {
          if (method === 'Network.responseReceived') {
            types.set(params.requestId, params.response.mimeType || '')
            if (!resource(params.response.url, params.response.mimeType || '')) throw new Error('Excluded browser resource')
          }
          if (method === 'Network.dataReceived') {
            const size = (sizes.get(params.requestId) || 0) + params.dataLength
            sizes.set(params.requestId, size)
            const type = types.get(params.requestId) || ''
            let max = config.maxFileSize
            if (type.includes('text/html')) max = Math.min(max, 20)
            if (type.startsWith('image/')) max = Math.min(max, config.maxImgSize)
            if (/^(audio|video)\//.test(type)) max = Math.min(max, config.maxVideoSize)
            if (size > max * MB) throw new Error('Browser resource size limit reached')
            this.charge(params.dataLength, config)
          }
        } catch (cause) { stop(cause instanceof Error ? cause : new Error(String(cause))) }
      })
      await window.loadURL(url)
      if (error) throw error
      const result = await window.webContents.executeJavaScript('({url:location.href,html:document.documentElement.outerHTML})', true) as { url: string; html: string }
      if (error) throw error
      if (signal.aborted) throw new Error('Cancelled')
      return result
    } catch (cause) { throw error || cause }
    finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', aborted)
      closing = true
      if (!window.isDestroyed()) {
        if (window.webContents.debugger.isAttached()) window.webContents.debugger.detach()
        window.destroy()
      }
      this.windows.delete(window)
      this.policies.delete(contentsId)
    }
  }
  async file(url: string, config: MirrorConfig, signal: AbortSignal, chunk: (data: Uint8Array, type: string) => Promise<void>) {
    mirrorUrl(url)
    this.requests += 1
    if (this.requests > config.maxFiles + config.maxPages) throw new Error('Network request limit reached')
    const response = await request.get(url, {
      responseType: 'stream', signal, timeout: config.timeout, maxRedirects: 5,
      headers: { cookie: (await this.session?.cookies.get({ url }) || []).map((cookie) => `${cookie.name}=${cookie.value}`).join('; ') },
      ...(config.proxy ? { proxy: false, httpAgent: new HttpProxyAgent({ proxy: config.proxy }), httpsAgent: new HttpsProxyAgent({ proxy: config.proxy }) } : {}),
      beforeRedirect: (options: any) => { mirrorUrl(`${options.protocol}//${options.hostname}${options.path}`) }
    })
    const stream = response.data
    this.streams.add(stream)
    const type = String(response.headers['content-type'] || '')
    const timer = setTimeout(() => stream.destroy(new Error('File timeout')), config.timeout)
    try { for await (const data of stream) { this.charge(data.byteLength, config); await chunk(data, type) } }
    finally { clearTimeout(timer); stream.destroy(); this.streams.delete(stream) }
  }
  async close() {
    this.deliberateClose = true
    for (const window of this.windows) if (!window.isDestroyed()) window.destroy()
    this.windows.clear()
    this.policies.clear()
    for (const stream of this.streams) stream.destroy(new Error('Mirror closed'))
    this.streams.clear()
    this.session?.webRequest.onBeforeRequest(null)
    this.session?.webRequest.onHeadersReceived(null)
    await this.session?.clearStorageData()
    await this.session?.clearCache()
  }
}
