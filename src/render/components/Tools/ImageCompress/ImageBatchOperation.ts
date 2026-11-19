import type { BatchImageInfoItem, BatchImageResultItem, SharpConfig } from '../../../../fork/module/Image/imageCompress.type'
import { snapshotImageConfig } from './ImagePipelineConfig'

type Reply = { code?: number; msg?: unknown; data?: unknown }
type ImageProgress = { allFile?: Array<{ path: string }>; successTask?: any[]; failTask?: any[] }
export type ImageBatchDependencies = {
  ipc: { send(command: string, ...args: unknown[]): { key: string; then(callback: (key: string, response: Reply) => void): void }; off(key: string): void }
  config(): SharpConfig
  notice(message: string): void
  observe?(callback: () => void, milliseconds: number): ReturnType<typeof setTimeout>
  stopObserving?(timer: ReturnType<typeof setTimeout>): void
}
export class ImageBatchOperation {
  images: BatchImageInfoItem[] = []
  saveDir = ''
  backupDir = ''
  rewrite = false
  trialStartTime = 0
  fetching = false
  processing = false
  unknown = false
  error = ''
  status = 'Idle'
  outcomes: Record<string, 'completed' | 'failed' | 'skipped' | 'unknown'> = {}
  warnings: string[] = []
  constructor(private deps: ImageBatchDependencies) {}
  get busy() { return this.fetching || this.processing || this.unknown }
  clear() { if (this.busy) return false; this.images = []; this.outcomes = {}; return true }
  remove(path: string) { if (this.busy) return false; this.images = this.images.filter((item) => item.path !== path); delete this.outcomes[path]; return true }
  imageSelected(paths: string[]) {
    if (this.busy) return false
    const all = Array.from(new Set(paths.filter((path) => path.trim() && !this.images.some((image) => image.path === path))))
    if (!all.length) return false
    this.fetching = true; this.error = ''; this.status = 'Reading images'
    this.request('fetchDirFile', [all], (data) => {
      for (const item of data.allFile ?? []) if (!this.images.some((image) => image.path === item.path)) this.images.push({ path: item.path, status: 'fetching' } as BatchImageInfoItem)
      for (const task of [...(data.successTask ?? []), ...(data.failTask ?? [])]) {
        const item = this.images.find((image) => image.path === task.path)
        if (item) Object.assign(item, task, { status: 'fetched' })
      }
    }, (reply) => {
      this.fetching = false
      for (const item of this.images.filter((image) => image.status === 'fetching')) Object.assign(item, { status: 'fetched', hasError: true, errorMessage: 'Image metadata was not returned.' })
      this.status = reply.code === 0 ? 'Images ready' : 'Image discovery failed'
      if (reply.code !== 0) this.fail(String(reply.msg ?? 'Image discovery failed.'))
    })
    return true
  }
  doProcess() {
    if (this.busy) return false
    let config: SharpConfig
    try {
      config = snapshotImageConfig(this.deps.config())
      if (this.rewrite && !this.backupDir.trim()) throw new Error('Choose a backup folder before overwriting images.')
      if (!this.rewrite && !this.saveDir.trim()) throw new Error('Choose an output folder.')
      if (this.rewrite && this.images.some((image) => this.backupDir.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase() === image.path.replace(/\\/g, '/').split('/').slice(0, -1).join('/').toLowerCase())) throw new Error('The backup folder must differ from every source folder.')
    } catch (error) { this.fail(error instanceof Error ? error.message : String(error)); return false }
    this.outcomes = {}
    const candidates = this.images.filter((image) => {
      if (image.status === 'fetching' || image.hasError || !image.width || !image.height || !image.ext) { this.outcomes[image.path] = 'skipped'; return false }
      return true
    })
    if (!candidates.length) { this.fail('No images with valid metadata are ready.'); return false }
    const files = JSON.parse(JSON.stringify(candidates)) as BatchImageInfoItem[]
    for (const item of candidates) { delete item.result; item.status = 'processing' }
    this.processing = true; this.error = ''; this.status = 'Processing images'
    this.request('doCompressTask', [files, config, this.rewrite ? '' : this.saveDir, this.rewrite ? this.backupDir : '', this.trialStartTime], (data) => {
      for (const task of [...(data.successTask ?? []), ...(data.failTask ?? [])] as BatchImageResultItem[]) {
        const item = this.images.find((image) => image.path === task.image?.path)
        if (item) { item.result = task; item.status = 'processed'; this.outcomes[item.path] = task.hasError ? 'failed' : 'completed' }
      }
    }, (reply) => {
      this.processing = false
      const pending = candidates.filter((item) => item.status === 'processing')
      for (const item of pending) this.outcomes[item.path] = 'unknown'
      this.unknown = pending.length > 0
      const completed = candidates.filter((item) => this.outcomes[item.path] === 'completed').length
      const failed = candidates.filter((item) => this.outcomes[item.path] === 'failed').length
      this.status = this.unknown ? 'Outcome unknown' : failed ? 'Partially completed' : 'Completed'
      if (reply.code !== 0 || pending.length) this.fail(String(reply.msg ?? 'Some image results were not returned. Completed files have been preserved.'))
      else if (failed) this.error = completed + ' completed; ' + failed + ' failed. See individual results.'
    })
    return true
  }
  private fail(message: string) { this.error = message; this.deps.notice(message) }
  private request(method: string, args: unknown[], progress: (data: ImageProgress) => void, terminal: (reply: Reply) => void) {
    let timer: ReturnType<typeof setTimeout> | undefined
    let key = ''
    let settled = false
    const stop = () => { if (timer) (this.deps.stopObserving ?? clearTimeout)(timer); if (key) this.deps.ipc.off(key) }
    try {
      const sent = this.deps.ipc.send('app-fork:image', method, ...args)
      key = sent.key
      sent.then((_key, reply) => {
        if (settled) return
        if (reply?.code !== 100 && reply?.code !== 200) { settled = true; stop(); this.unknown = false; terminal(reply ?? { code: 1, msg: 'Invalid image response.' }); return }
        if (reply?.msg && typeof reply.msg === 'object') {
          try { progress(reply.msg as ImageProgress) }
          catch (error) { this.warnings.push('Image progress could not be displayed: ' + String(error)) }
        }
      })
      if (!settled) timer = (this.deps.observe ?? setTimeout)(() => {
        this.unknown = true; this.status = 'Outcome unknown'
        this.fail('No terminal image result has arrived. Work may still be running; replay is blocked until the original request finishes.')
      }, 10 * 60 * 1000)
    } catch (error) {
      if (settled) return
      settled = true
      stop()
      terminal({ code: 1, msg: error instanceof Error ? error.message : String(error) })
    }
  }
}
