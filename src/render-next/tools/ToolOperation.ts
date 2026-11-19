export type ToolReply = { code?: number; msg?: any; data?: any }
export type ToolTransport = { send(command: string, ...args: unknown[]): { key: string; then(callback: (key: string, reply: ToolReply) => void): void }; off(key: string): void }

/** One module-owned request retains unknown work until its original terminal. */
export class ToolOperation {
  running = false
  unknown = false
  error = ''
  warning = ''
  done = false
  progress: any
  private operation?: Promise<boolean>
  constructor(readonly transport: ToolTransport) {}
  runLocal(action: () => Promise<void>) {
    if (this.operation) return this.operation
    this.running = true; this.done = false; this.error = ''
    this.operation = Promise.resolve().then(action).then(() => { this.done = true; return true }).catch((error) => { this.error = String(error); return false }).finally(() => { this.running = false; this.operation = undefined })
    return this.operation
  }
  run(command: string, args: unknown[], completed: (data: any) => void, progress?: (data: any) => void) {
    if (this.operation) return this.operation
    this.running = true; this.unknown = false; this.error = ''; this.warning = ''; this.done = false; this.progress = undefined
    let resolve!: (done: boolean) => void
    this.operation = new Promise<boolean>((done) => { resolve = done })
    const operation = this.operation
    let timer: ReturnType<typeof setTimeout> | undefined
    let key = ''
    let settled = false
    const terminal = (reply: ToolReply) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (key) this.transport.off(key)
      this.running = false; this.unknown = false; this.operation = undefined
      if (reply?.code === 0) {
        this.done = true
        try { completed(reply.data) }
        catch (error) { this.warning = 'The operation completed, but updating its view failed: ' + String(error) }
        resolve(true)
      }
      else { this.error = String(reply?.msg ?? 'Tool operation failed.'); resolve(false) }
    }
    try {
      const sent = this.transport.send(command, ...JSON.parse(JSON.stringify(args)))
      key = sent.key
      sent.then((_key, reply) => {
        if (settled) return
        if (reply?.code !== 100 && reply?.code !== 200) { terminal(reply); return }
        this.progress = reply.msg
        try { progress?.(reply.msg) }
        catch (error) { this.warning = 'Progress could not be displayed: ' + String(error) }
      })
      if (!settled) timer = setTimeout(() => { this.unknown = true; this.error = 'No terminal result has arrived. Work may still be running; duplicate execution is blocked.' }, 10 * 60 * 1000)
    } catch (error) { terminal({ code: 1, msg: error instanceof Error ? error.message : String(error) }) }
    return operation
  }
}
