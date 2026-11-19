import type { StaticHttpServe } from '../type'
import type { IncomingMessage, ServerResponse } from 'http'
import ServeHandler from 'serve-handler'
import Http from 'http'
import { getAllLocalIPAddresses } from '@shared/network'
import type { AddressInfo } from 'node:net'
import { stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'

export async function verifyHttpServeFolder(path: unknown): Promise<string> {
  if (typeof path === 'string' && isAbsolute(path) && (await stat(path)).isDirectory()) return path
  throw new Error('Choose an existing folder to serve.')
}

class HttpServer {
  private readonly servers = new Map<string, StaticHttpServe>()
  private readonly pending = new Map<string, Promise<unknown>>()

  verifyFolder(path: string) {
    return verifyHttpServeFolder(path)
  }

  private sequence<T>(path: string, execute: () => Promise<T>) {
    const result = (this.pending.get(path) ?? Promise.resolve()).catch(() => {}).then(execute)
    this.pending.set(path, result)
    const release = () => {
      if (this.pending.get(path) === result) this.pending.delete(path)
    }
    void result.then(release, release)
    return result
  }

  async snapshot() {
    while (this.pending.size) await Promise.allSettled(this.pending.values())
    return Array.from(this.servers, ([path, { port, host }]) => ({ path, port, host }))
  }

  start(path: string) {
    return this.sequence(path, async () => {
      const existing = this.servers.get(path)
      if (existing) return { path, port: existing.port, host: existing.host }
      await verifyHttpServeFolder(path)
      const server = Http.createServer((request: IncomingMessage, response: ServerResponse) => {
        response.setHeader('Access-Control-Allow-Origin', '*')
        response.setHeader('Access-Control-Allow-Headers', '*')
        response.setHeader('Access-Control-Allow-Methods', '*')
        return ServeHandler(request, response, {
          public: path
        })
      })
      const addresses = getAllLocalIPAddresses()
      const physical = addresses.filter((item) => !item.isVirtual)
      const advertised = physical.length ? physical : addresses.slice(0, 1)
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, () => {
          server.off('error', reject)
          resolve()
        })
      })
      const { port } = server.address() as AddressInfo
      const host = [
        `http://localhost:${port}/`,
        ...advertised.map(({ ip }) => `http://${ip}:${port}/`)
      ]
      this.servers.set(path, { server, port, host })
      return { path, port, host }
    })
  }

  stop(path: string) {
    return this.sequence(path, async () => {
      const item = this.servers.get(path)
      if (!item) return path
      await new Promise<void>((resolve, reject) => {
        item.server.close((error) => {
          if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING')
            reject(error)
          else resolve()
        })
        item.server.closeAllConnections()
      })
      this.servers.delete(path)
      return path
    })
  }

  async stopAll() {
    const paths = new Set([...this.servers.keys(), ...this.pending.keys()])
    const results = await Promise.allSettled(Array.from(paths, (path) => this.stop(path)))
    const failures = results.flatMap((result) =>
      result.status === 'rejected' ? [result.reason] : []
    )
    if (failures.length) throw new AggregateError(failures, 'Some HTTP servers could not stop.')
  }
}

export default new HttpServer()
