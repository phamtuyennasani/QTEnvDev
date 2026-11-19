import { ToolOperation, type ToolTransport } from './ToolOperation'
export type TimingMetric = { Metric: string; Value: string | number }
export class RequestTimingOperation {
  url = ''
  list: TimingMetric[] = []
  operation: ToolOperation
  constructor(transport: ToolTransport) { this.operation = new ToolOperation(transport, 60_000) }
  get loading() { return this.operation.running }
  get error() { return this.operation.error || this.operation.warning }
  fetch() {
    if (this.operation.running) return this.operation.run('app-fork:tools', [], () => undefined)
    let url: URL
    try { url = new URL(this.url.trim()); if (!['http:', 'https:'].includes(url.protocol)) throw new Error() }
    catch { this.operation.error = 'Enter a valid HTTP or HTTPS URL.'; return false }
    return this.operation.run('app-fork:tools', ['requestTimeFetch', url.href], (data) => {
      if (!Array.isArray(data) || !data.every((item) => typeof item?.Metric === 'string' && ['string', 'number'].includes(typeof item.Value))) throw new Error('Invalid timing response.')
      this.list = data
    })
  }
}
