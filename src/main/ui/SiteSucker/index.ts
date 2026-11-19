import { randomUUID } from 'node:crypto'
import { MirrorOperation, type MirrorEvent } from './Operation'
import { MirrorBrowserAdapter } from './BrowserAdapter'
import type { MirrorConfig } from './Policy'
import type { CallbackFn } from '@shared/app'
class SiteSucker {
  private operation?: MirrorOperation
  private callback: CallbackFn = () => {}
  setCallback(callback: CallbackFn) { this.callback = callback }
  show(item: { operationId?: string; url: string; config: Partial<MirrorConfig> }) {
    if (this.operation?.snapshot().state === 'running') throw new Error('A mirror is already running')
    const id = item.operationId || randomUUID()
    const adapter = new MirrorBrowserAdapter(id, () => { void this.destroy() })
    this.operation = new MirrorOperation(id, item.url, item.config, adapter, (event: MirrorEvent) => this.callback(event))
    void this.operation.run()
    return this.operation.snapshot()
  }
  status() { return this.operation?.snapshot() }
  // A running operation retains its request snapshot; edits apply to the next run.
  updateConfig(_config: unknown) {}
  async destroy() { return this.operation?.cancel() }
}
export default new SiteSucker()
