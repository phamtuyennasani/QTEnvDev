import { Base } from '../Base'
import { ForkPromise } from '@shared/ForkPromise'
import { withServiceStopContext, type ServiceStopContext } from '@shared/ServiceStopContext'
import DNS2 from 'dns2'
import { createRequire } from 'node:module'
import { isLinux, isMacOS, isWindows } from '@shared/utils'
import type { SoftInstalled } from '@shared/app'
import { mkdirp, existsSync, writeFile, readFile, readFileByRoot } from '../../Fn'
import { dirname, join } from 'node:path'
import { HostsFileLinux, HostsFileMacOS } from '@shared/PlatFormConst'
import { windowsSystemDirectory } from '@shared/WindowsSystemPaths'
import { getPrimaryLocalIPAddress } from '@shared/network'
import { isIPv4 } from 'node:net'
import { rename, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { Buffer } from 'node:buffer'

const require = createRequire(import.meta.url)
const Tangerine = require('tangerine')

const { createServer, Packet } = DNS2

class Manager extends Base {
  private server?: ReturnType<typeof createServer>
  lastTime: number
  private hosts: Record<string, string> = Object.create(null)
  private systemHosts: Record<string, string> = Object.create(null)
  private appHosts = new Set<string>()
  localIP: string = ''
  private activeAddress = ''
  private operation: Promise<unknown> = Promise.resolve()

  constructor() {
    super()
    this.server = undefined
    this.lastTime = 0
  }

  initConfig() {
    return this.exclusive(() => this.ensureConfig())
  }

  private async ensureConfig() {
    const file = join(global.Server.BaseDir!, 'dns/dns.json')
    await mkdirp(dirname(file))
    const json = {
      resolveServer:
        global.Server.Lang === 'zh'
          ? ['223.5.5.5', '119.29.29.29', '180.76.76.76', '114.114.114.119']
          : ['1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4'],
      resolveIP: { 'phpmyadmin.test': '127.0.0.1' },
      bind: '0.0.0.0'
    }
    const defaultFile = join(global.Server.BaseDir!, 'dns/dns.default.json')
    const source = JSON.stringify(json, null, 2)
    if (!existsSync(defaultFile)) await writeFile(defaultFile, source)
    if (!existsSync(file)) await writeFile(file, source)
    return file
  }

  private exclusive<T>(task: () => T | PromiseLike<T>) {
    const next = this.operation.then(task)
    this.operation = next.then(
      () => undefined,
      () => undefined
    )
    return new ForkPromise<T>((resolve, reject) => next.then(resolve, reject))
  }

  workspaceStatus() {
    return this.exclusive(() => ({
      running: Boolean(this.activeAddress),
      address: this.activeAddress,
      localIP: this.localIP
    }))
  }

  workspaceConfig() {
    return this.exclusive(async () => {
      const path = await this.ensureConfig()
      const [content, defaults] = await Promise.all([
        readFile(path, 'utf8'),
        readFile(join(dirname(path), 'dns.default.json'), 'utf8')
      ])
      return { path, content, defaults }
    })
  }

  saveWorkspaceConfig(expected: string, content: string) {
    return this.exclusive(async () => {
      if (typeof content !== 'string' || Buffer.byteLength(content) > 256 * 1024) {
        throw new Error('Use a DNS settings file smaller than 256 KB.')
      }
      const config = JSON.parse(content)
      if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new Error('DNS settings must be a JSON object.')
      }
      if (config.bind !== undefined && !isIPv4(config.bind)) {
        throw new Error('Bind must be an IPv4 address.')
      }
      if (
        config.resolveServer !== undefined &&
        (!Array.isArray(config.resolveServer) ||
          config.resolveServer.some(
            (server: unknown) => typeof server !== 'string' || !server.trim()
          ))
      ) {
        throw new Error('Resolve servers must be a list of addresses.')
      }
      if (
        config.resolveIP !== undefined &&
        (!config.resolveIP ||
          typeof config.resolveIP !== 'object' ||
          Array.isArray(config.resolveIP) ||
          Object.values(config.resolveIP).some((address) => !isIPv4(String(address))))
      ) {
        throw new Error('Host records must map hostnames to IPv4 addresses.')
      }
      const path = await this.ensureConfig()
      if ((await readFile(path, 'utf8')) !== expected) {
        throw new Error('The configuration changed. Refresh before saving.')
      }
      const temporary = path + '.' + randomUUID() + '.tmp'
      try {
        await writeFile(temporary, content, { flag: 'wx' })
        await rename(temporary, path)
      } finally {
        await rm(temporary, { force: true }).catch(() => undefined)
      }
      return { content }
    })
  }

  initAppHosts(appHosts: string[]) {
    return new ForkPromise((resolve) => {
      if (!Array.isArray(appHosts) || appHosts.some((host) => typeof host !== 'string')) {
        throw new Error('Expected a list of site hostnames.')
      }
      this.appHosts = new Set(appHosts.map((name) => name.toLowerCase()))
      resolve(true)
    })
  }

  async initHosts(LOCAL_IP: string) {
    let hostFile = ''
    if (isWindows()) {
      // DNS 读取与 Host/UAC 写入共用系统目录规则，兼容非 C 盘 Windows。
      hostFile = join(windowsSystemDirectory(), 'drivers', 'etc', 'hosts')
    } else if (isLinux()) {
      hostFile = HostsFileLinux
    } else if (isMacOS()) {
      hostFile = HostsFileMacOS
    }
    const time = new Date().getTime()
    if (time - this.lastTime > 60000) {
      this.lastTime = time
      try {
        const hosts = Object.create(null)
        const source = await readFileByRoot(hostFile)
        for (const line of source.split('\n')) {
          const [raw, ...names] = line.split('#', 1)[0].trim().split(/\s+/)
          const ip = ['::1', '127.0.0.1'].includes(raw) ? LOCAL_IP : raw
          if (isIPv4(ip)) for (const name of names) hosts[name.toLowerCase()] = ip
        }
        this.systemHosts = hosts
      } catch {}
    }
  }

  checkWildcardDomainMatch(domain: string) {
    const arr = domain.split('.')
    /**
     * *.www.xxx.test
     * *.xxx.test
     * *.test
     */
    const domains: string[] = [['*', ...arr].join('.')]
    while (arr.length > 1) {
      arr.shift()
      domains.push(`${['*', ...arr].join('.')}`)
    }
    return domains.find((name) => this.systemHosts[name] || this.hosts[name])
  }

  start() {
    return new ForkPromise(async (resolve, reject) => {
      const tangerine = new Tangerine()
      const file = join(global.Server.BaseDir!, 'dns/dns.json')
      let resolveIP: Record<string, string> = {}
      let bind = '0.0.0.0'
      if (existsSync(file)) {
        const content = await readFile(file, 'utf-8')
        const json = JSON.parse(content)
        resolveIP = json?.resolveIP ?? {}
        const resolveServer = json?.resolveServer ?? []
        if (resolveServer.length > 0) {
          tangerine.setServers(resolveServer)
        }
        bind = json?.bind ?? '0.0.0.0'
      }
      this.hosts = Object.create(null)
      for (const [name, ip] of Object.entries(resolveIP)) {
        if (typeof ip === 'string' && isIPv4(ip)) this.hosts[name.toLowerCase()] = ip
      }
      this.systemHosts = Object.create(null)
      this.lastTime = 0
      const LOCAL_IP = getPrimaryLocalIPAddress() || '127.0.0.1'
      const server = createServer({
        udp: true,
        handle: (request, send) => {
          const response = Packet.createResponseFromRequest(request)
          const [question] = request.questions
          const name = question?.name
          const sendResponse = () => {
            void Promise.resolve(send(response)).catch(() => undefined)
          }
          if (!name || question.type !== Packet.TYPE.A) {
            sendResponse()
            return
          }
          void this.initHosts(LOCAL_IP)
          const lookup = name.toLowerCase()
          const wildcard = this.checkWildcardDomainMatch(lookup)
          const local =
            (this.appHosts.has(lookup) ? this.localIP : '') ||
            this.systemHosts[lookup] ||
            this.hosts[lookup] ||
            (wildcard && (this.systemHosts[wildcard] || this.hosts[wildcard]))
          if (local) {
            const ip = local
            const item: any = {
              name,
              type: Packet.TYPE.A,
              class: Packet.CLASS.IN,
              ttl: 60,
              address: ip
            }
            process?.send?.({
              on: true,
              key: 'App_DNS_Log',
              info: {
                host: name,
                ttl: 60,
                ip: ip
              }
            })
            response.answers.push(item)
            sendResponse()
            return
          }
          try {
            tangerine
              .resolve(name, 'A', {
                ttl: true
              })
              .then((res: any) => {
                if (res && Array.isArray(res)) {
                  res.forEach((item) => {
                    response.answers.push({
                      name,
                      type: Packet.TYPE.A,
                      class: Packet.CLASS.IN,
                      ttl: item.ttl,
                      address: item.address
                    } as any)
                    process?.send?.({
                      on: true,
                      key: 'App_DNS_Log',
                      info: {
                        host: name,
                        ttl: item.ttl,
                        ip: item.address
                      }
                    })
                  })
                }
                sendResponse()
              })
              .catch((e: any) => {
                console.log(`tangerine resolve error: ${e}`)
                sendResponse()
              })
          } catch {
            sendResponse()
          }
        }
      })

      server.once('listening', () => {
        this.server = server
        this.activeAddress = bind
        this.localIP = bind === '0.0.0.0' ? LOCAL_IP : bind
        resolve(true)
      })

      server.once('close', () => {
        if (this.server === server) {
          this.server = undefined
          this.activeAddress = ''
          this.localIP = ''
        }
      })

      server.on('error', (error) => {
        reject(error)
      })

      void server.listen({ udp: { port: 53, address: bind } }).catch(reject)
    })
  }
  async close() {
    // DNS server 由专用 fork 持有；await close 确认 socket 已释放，拒绝时保留实例供重试。
    await this.server?.close?.()
    this.server = undefined
    this.activeAddress = ''
    this.localIP = ''
  }

  stopService(_version?: SoftInstalled, stopOptions?: ServiceStopContext): any {
    // 与其他模块使用同一可选参数位置；DNS 仅关闭自己 socket，不消费列表或 kill 宿主。
    return withServiceStopContext(stopOptions, () =>
      this.exclusive(async () => {
        await this.close()
        // 回传的是宿主 fork PID 供登记清理，绝不把宿主 Electron worker 当作外部服务去 kill。
        return { 'APP-Service-Stop-PID': [`${process.pid}`] }
      })
    )
  }

  startService(): ForkPromise<any> {
    return this.exclusive(async () => {
      // 与外部服务采用同一成功终态登记，但停止动作仅关闭模块自己的 socket。
      if (!this.activeAddress) {
        await this.ensureConfig()
        await this.start()
      }
      return {
        'APP-Service-Start-PID': `${process.pid}`,
        address: this.activeAddress,
        localIP: this.localIP
      }
    })
  }

  getConfigFiles(_version?: SoftInstalled): Array<{ name: string; path: string }> {
    const baseDir = join(global.Server.BaseDir!, 'dns')
    return [
      { name: 'DNS config', path: join(baseDir, 'dns.json') },
      { name: 'DNS default config', path: join(baseDir, 'dns.default.json') }
    ]
  }

  getLogFiles(_version?: SoftInstalled): Array<{ name: string; path: string }> {
    return []
  }
}

export default new Manager()
