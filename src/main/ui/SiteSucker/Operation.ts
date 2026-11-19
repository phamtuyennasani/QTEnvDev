import { createHash } from 'node:crypto'
import { extname, join, relative } from 'node:path'
import { mkdir, writeFile, rename, rm } from 'node:fs/promises'
import { mirrorConfig, mirrorUrl, type MirrorConfig } from './Policy'

export type MirrorLink = { url: string; state: 'wait' | 'running' | 'success' | 'fail' | 'skipped'; type?: string; size?: number; reason?: string; file?: string }
export type MirrorSnapshot = { operationId: string; state: 'running' | 'completed' | 'partial' | 'cancelled' | 'failed'; links: MirrorLink[]; bytes: number; message?: string }
export type MirrorEvent = { operationId: string; kind: 'link'; link: MirrorLink } | { operationId: string; kind: 'terminal'; result: MirrorSnapshot }
export type MirrorAdapter = {
  page(url: string, config: MirrorConfig, signal: AbortSignal, resource: (url: string, type: string) => boolean): Promise<{ url: string; html: string }>
  file(url: string, config: MirrorConfig, signal: AbortSignal, chunk: (data: Uint8Array, type: string) => Promise<void>): Promise<void>
  close(): Promise<void>
}
export class MirrorLimitError extends Error {}
type Job = { link: MirrorLink; page: boolean }
const MB = 1024 * 1024
const baseExcluded = ['www.google-analytics.com', 'hm.baidu.com', 'www.googletagmanager.com', 'static.hotjar.com', 'apis.google.com', 'www.google.com']

/** One bounded mirror. Streams and windows belong to its adapter, never to the renderer. */
export class MirrorOperation {
  readonly config: MirrorConfig
  readonly operationId: string
  private abort = new AbortController()
  private jobs: Job[] = []
  private records = new Map<string, MirrorLink>()
  private pageCount = 0
  private fileCount = 0
  private bytes = 0
  private cancelled = false
  private limited = false
  private root: string
  private start: URL
  private state: MirrorSnapshot['state'] = 'running'
  private message?: string
  private promise?: Promise<MirrorSnapshot>
  private timer?: ReturnType<typeof setTimeout>

  constructor(id: string, url: string, config: Partial<MirrorConfig>, private adapter: MirrorAdapter, private emit: (event: MirrorEvent) => void) {
    this.operationId = id
    this.config = mirrorConfig(config)
    this.start = mirrorUrl(url)
    if (!this.config.dir) throw new Error('Choose an output folder')
    this.root = join(this.config.dir, this.start.host.replace(/[^a-z0-9.-]/gi, '_'))
  }
  snapshot(): MirrorSnapshot {
    return { operationId: this.operationId, state: this.state, links: [...this.records.values()].map((link) => ({ ...link })), bytes: this.bytes, message: this.message }
  }
  private notice(link: MirrorLink) { this.emit({ operationId: this.operationId, kind: 'link', link: { ...link } }) }
  private excluded(url: URL) {
    const excluded = [...baseExcluded, ...this.config.excludeLink.split('\n').map((value) => value.trim()).filter(Boolean)]
    return excluded.some((value) => url.host === value || url.href.includes(value))
  }
  private output(url: URL, page: boolean) {
    const hash = createHash('sha256').update(url.href).digest('hex').slice(0, 24)
    const extension = page ? '.html' : extname(url.pathname).replace(/[^a-z0-9.]/gi, '').slice(0, 12)
    return page && url.href === this.start.href ? 'index.html' : `${page ? 'pages' : 'assets'}/${hash}${extension || '.bin'}`
  }
  private queue(value: string, page: boolean, base = this.start.href): string | undefined {
    if (this.abort.signal.aborted) return undefined
    let url: URL
    try { url = mirrorUrl(value, base) } catch { return undefined }
    if ((url.href !== this.start.href && this.excluded(url)) || (page && (url.host !== this.start.host || (this.config.pageLimit && !url.href.includes(this.config.pageLimit) && url.href !== this.start.href)))) return undefined
    const existing = this.records.get(url.href)
    if (existing) return existing.file
    if (page ? this.pageCount >= this.config.maxPages : this.fileCount >= this.config.maxFiles) {
      this.limited = true
      return undefined
    }
    const file = this.output(url, page)
    const link: MirrorLink = { url: url.href, file, state: 'wait' }
    this.records.set(url.href, link)
    if (page) this.pageCount += 1; else this.fileCount += 1
    this.jobs.push({ link, page })
    this.notice(link)
    return file
  }
  private reserve(size: number, itemBytes: number, type: string, page: boolean) {
    let max = this.config.maxFileSize
    if (type.startsWith('image/')) max = Math.min(max, this.config.maxImgSize)
    if (/^(audio|video)\//.test(type)) max = Math.min(max, this.config.maxVideoSize)
    if (page) max = Math.min(max, 20)
    if (itemBytes > max * MB) throw new Error(`File exceeds ${max} MB`)
    if (this.bytes + size > this.config.maxTotalSize * MB) {
      this.limited = true
      throw new Error(`Mirror exceeds ${this.config.maxTotalSize} MB total`)
    }
    this.bytes += size
  }
  private rewrite(html: string, page: MirrorLink) {
    const rewritten = html.replace(/\b(href|src|poster)\s*=\s*(["'])(.*?)\2/gi, (original, attr: string, quote: string, raw: string) => {
      if (!raw || raw.startsWith('#') || raw.startsWith('data:')) return original
      const isPage = attr.toLowerCase() === 'href' && !/\.(css|js|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|pdf)(?:[?#]|$)/i.test(raw)
      const file = this.queue(raw.replace(/&amp;/g, '&'), isPage, page.url)
      if (!file) return original
      const from = join(this.root, page.file!)
      const target = relative(join(from, '..'), join(this.root, file)).replace(/\\/g, '/')
      return `${attr}=${quote}${target}${quote}`
    })
    return rewritten.replace(/\bsrcset\s*=\s*(["'])(.*?)\1/gi, (original, quote: string, raw: string) => {
      if (raw.includes('data:')) return original
      const value = raw.split(',').map((candidate) => {
        const [url, ...descriptor] = candidate.trim().split(/\s+/)
        const file = this.queue(url, false, page.url)
        const target = file ? relative(join(this.root, page.file!, '..'), join(this.root, file)).replace(/\\/g, '/') : url
        return [target, ...descriptor].join(' ')
      }).join(', ')
      return 'srcset=' + quote + value + quote
    }).replace(/\bstyle\s*=\s*(["'])(.*?)\1/gi, (_original, quote: string, css: string) => 'style=' + quote + this.rewriteCss(css, page) + quote)
      .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_original, open: string, css: string, close: string) => open + this.rewriteCss(css, page) + close)
  }
  private rewriteCss(css: string, link: MirrorLink) {
    const local = (value: string) => {
      if (!value || /^(data:|#)/i.test(value)) return value
      const file = this.queue(value, false, link.url)
      return file ? relative(join(this.root, link.file!, '..'), join(this.root, file)).replace(/\\/g, '/') : value
    }
    return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (_all, quote: string, value: string) => 'url(' + quote + local(value.trim()) + quote + ')')
      .replace(/@import\s+(["'])([^"']+)\1/gi, (_all, quote: string, value: string) => '@import ' + quote + local(value) + quote)
  }
  private async process(job: Job, attempt = 1): Promise<void> {
    const { link, page } = job
    link.state = 'running'; this.notice(link)
    const file = join(this.root, link.file!)
    const temp = file + '.part-' + this.operationId.replace(/[^a-z0-9-]/gi, '').slice(0, 64)
    try {
      await mkdir(join(file, '..'), { recursive: true })
      if (this.abort.signal.aborted) throw new Error('Cancelled')
      let count = 0
      if (page) {
        const result = await this.adapter.page(link.url, this.config, this.abort.signal, (url, type) => {
          let parsed: URL
          try { parsed = mirrorUrl(url) } catch { return false }
          if (this.excluded(parsed)) return false
          if (type.includes('text/html') && parsed.host !== this.start.host) return false
          if (type && parsed.href !== link.url && !this.queue(parsed.href, type.includes('text/html'))) return false
          return true
        })
        const redirected = mirrorUrl(result.url)
        if (redirected.host !== this.start.host || this.excluded(redirected)) throw new Error('Redirected outside the allowed host or to an excluded URL')
        const rawBytes = Buffer.byteLength(result.html)
        this.reserve(rawBytes, rawBytes, 'text/html', true)
        const html = this.rewrite(result.html, { ...link, url: redirected.href })
        if (this.abort.signal.aborted) throw new Error('Cancelled')
        await writeFile(temp, html, 'utf8')
        count = Buffer.byteLength(html)
        link.type = 'text/html'
      } else {
        const { open } = await import('node:fs/promises')
        const handle = await open(temp, 'w')
        const css: Buffer[] = []
        try {
          await this.adapter.file(link.url, this.config, this.abort.signal, async (chunk, type) => {
            if (this.abort.signal.aborted) throw new Error('Cancelled')
            count += chunk.byteLength
            this.reserve(chunk.byteLength, count, type, false)
            link.type = type
            if (type.includes('text/css') || extname(new URL(link.url).pathname).toLowerCase() === '.css') {
              if (count > 20 * MB) throw new Error('CSS exceeds 20 MB')
              css.push(Buffer.from(chunk))
              return
            }
            let offset = 0
            while (offset < chunk.byteLength) {
              const written = await handle.write(chunk, offset, chunk.byteLength - offset)
              if (!written.bytesWritten) throw new Error('File write made no progress')
              offset += written.bytesWritten
            }
          })
          if (css.length) {
            const rewritten = this.rewriteCss(Buffer.concat(css).toString('utf8'), link)
            await handle.writeFile(rewritten, 'utf8')
          }
        } finally { await handle.close() }
      }
      if (this.abort.signal.aborted) throw new Error('Cancelled')
      await rename(temp, file)
      link.size = count; link.state = 'success'; link.reason = undefined
    } catch (error) {
      if (!this.abort.signal.aborted && !(error instanceof MirrorLimitError) && attempt < this.config.maxRetryTimes && !/exceeds|limit reached|outside the allowed|excluded URL/i.test(String(error))) {
        await rm(temp, { force: true })
        link.reason = 'Retrying after attempt ' + attempt + ': ' + String(error)
        link.state = 'wait'; this.notice(link)
        await this.process(job, attempt + 1)
        return
      }
      link.state = this.cancelled ? 'skipped' : 'fail'
      link.reason = error instanceof Error ? error.message : String(error)
    } finally {
      try { await rm(temp, { force: true }) } catch (error) { link.reason = `${link.reason || ''} Temporary-file cleanup failed: ${String(error)}`.trim() }
      this.notice(link)
    }
  }
  run(): Promise<MirrorSnapshot> {
    if (this.promise) return this.promise
    this.promise = this.execute()
    return this.promise
  }
  private async execute(): Promise<MirrorSnapshot> {
    this.timer = setTimeout(() => { this.limited = true; this.message = 'Mirror duration limit reached'; this.abort.abort() }, this.config.maxDuration)
    try {
      await mkdir(this.root, { recursive: true })
      this.queue(this.start.href, true)
      // A round drains its admitted jobs; pages can enqueue the next round.
      while (this.jobs.length && !this.abort.signal.aborted) {
        const round = this.jobs.splice(0)
        let position = 0
        await Promise.all(Array.from({ length: Math.min(this.config.windowCount, round.length) }, async () => {
          while (position < round.length && !this.abort.signal.aborted) await this.process(round[position++])
          for (; position < round.length; position += 1) this.jobs.push(round[position])
        }))
      }
      for (const link of this.records.values()) if (link.state === 'wait') { link.state = 'skipped'; link.reason = this.message || 'Cancelled'; this.notice(link) }
      this.state = this.cancelled ? 'cancelled' : this.limited || [...this.records.values()].some((link) => link.state === 'fail') ? 'partial' : 'completed'
      if (this.limited && !this.message) this.message = 'One or more page, file or size limits were reached'
    } catch (error) { this.state = 'failed'; this.message = error instanceof Error ? error.message : String(error) }
    finally {
      clearTimeout(this.timer)
      try { await this.adapter.close() } catch (error) { this.state = this.state === 'completed' ? 'partial' : this.state; this.message = `Worker cleanup failed: ${String(error)}` }
    }
    const result = this.snapshot()
    this.emit({ operationId: this.operationId, kind: 'terminal', result })
    return result
  }
  cancel() { this.cancelled = true; this.abort.abort(); return this.run() }
}
