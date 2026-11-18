import { PackageOutcomeUnknown, packageError } from './types'

export type PackageReply = { code?: number; data?: unknown; msg?: unknown }
export type PackageIPC = {
  send(command: string, ...args: unknown[]): { key: string; then(callback: (key: string, reply: PackageReply) => void): void }
  off(key: string): void
}

/** The owner keeps progress listeners until a declared terminal result. */
export function packageRequest(
  ipc: PackageIPC,
  command: string,
  args: unknown[],
  options: { timeout?: number; mutation?: boolean; progress?: (message: unknown) => void } = {}
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let key: string | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let settled = false
    const finish = (error?: unknown, data?: unknown) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (key) ipc.off(key)
      error ? reject(error) : resolve(data)
    }
    try {
      const sent = ipc.send(command, ...args)
      key = sent.key
      timer = setTimeout(() => {
        const message = options.mutation
          ? 'The operation has not reported a result. Check the installed files before retrying; it may still be running.'
          : 'The package request timed out. Please try again.'
        finish(options.mutation ? new PackageOutcomeUnknown(message) : new Error(message))
      }, options.timeout ?? 90_000)
      sent.then((_key, reply) => {
        if (settled) return
        if (reply?.code === 200) {
          // Display/diagnostic failures cannot detach the real operation listener.
          try { options.progress?.(reply.msg) } catch (error) { console.error(packageError(error)) }
          return
        }
        if (reply?.code === 0) finish(undefined, reply.data)
        else finish(new Error(typeof reply?.msg === 'string' ? reply.msg : 'The package request failed.'))
      })
    } catch (error) { finish(error) }
  })
}
