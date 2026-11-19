import assert from 'node:assert/strict'
import { createSocket } from 'node:dgram'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import DNS2 from 'dns2'
import { ForkPromise } from '../src/shared/ForkPromise'
import { DnsServerController } from '../src/render-next/dnsServer/Controller'
import { loadIsolated } from './helpers/load-isolated'

const temp = await mkdtemp(join(tmpdir(), 'pqt-forge-dns-'))
const claim = createSocket('udp4')
await new Promise<void>((resolve) => claim.bind(0, '127.0.0.1', resolve))
const occupiedPort = claim.address().port
let port = occupiedPort
let starts = 0
const logs: unknown[] = []
const { default: fork } = await loadIsolated(
  'src/fork/module/DNS/index.ts',
  {
    '../Base': { Base: class {} },
    '@shared/ForkPromise': { ForkPromise },
    '@shared/ServiceStopContext': {
      withServiceStopContext: (_options: unknown, task: () => unknown) => task()
    },
    dns2: {
      Packet: DNS2.Packet,
      createServer(options: Parameters<typeof DNS2.createServer>[0]) {
        starts++
        const server = DNS2.createServer(options)
        const listen = server.listen.bind(server)
        server.listen = () => listen({ udp: { address: '127.0.0.1', port } })
        return server
      }
    },
    'node:module': {
      createRequire: () => () =>
        class {
          setServers() {}
        }
    },
    '@shared/utils': { isWindows: () => false, isLinux: () => false, isMacOS: () => false },
    '@shared/PlatFormConst': {},
    '@shared/WindowsSystemPaths': {},
    '@shared/network': { getPrimaryLocalIPAddress: () => '127.0.0.1' },
    '../../Fn': {
      mkdirp: (path: string) => mkdir(path, { recursive: true }),
      existsSync,
      readFile,
      writeFile,
      readFileByRoot: async () => ''
    }
  },
  {
    global: { Server: { BaseDir: temp } },
    process: { pid: process.pid, send: (event: { info: unknown }) => logs.push(event.info) }
  }
)
let claimClosed = false
try {
  const config = await fork.workspaceConfig()
  const saved = JSON.stringify({ bind: '127.0.0.1', resolveIP: { '*.local.test': '127.0.0.8' } })
  await assert.rejects(
    Promise.resolve(fork.saveWorkspaceConfig(config.content, '{"bind":"bad"}')),
    /IPv4/
  )
  await fork.saveWorkspaceConfig(config.content, saved)
  await assert.rejects(Promise.resolve(fork.saveWorkspaceConfig(config.content, '{}')), /changed/)
  assert.equal(await readFile(config.path, 'utf8'), saved)
  await assert.rejects(Promise.resolve(fork.startService()), { code: 'EADDRINUSE' })
  assert.equal((await fork.workspaceStatus()).running, false)
  await new Promise<void>((resolve) => claim.close(resolve))
  claimClosed = true

  const first = fork.startService()
  const duplicate = fork.startService()
  await Promise.all([first, duplicate])
  assert.equal(starts, 2)
  assert.equal((await fork.workspaceStatus()).address, '127.0.0.1')
  await fork.initAppHosts(['website.test'])
  const query = DNS2.UDPClient({ dns: '127.0.0.1', port, timeout: 1000 })
  assert.equal((await query('website.test')).answers[0]?.address, '127.0.0.1')
  assert.equal((await query('child.local.test')).answers[0]?.address, '127.0.0.8')
  assert.equal(logs.length, 2)
  await fork.stopService()
  assert.equal((await fork.workspaceStatus()).running, false)
  const withoutBind = JSON.stringify({ resolveIP: { '*.local.test': '127.0.0.8' } })
  await fork.saveWorkspaceConfig(saved, withoutBind)
  assert.equal(await readFile(config.path, 'utf8'), withoutBind)
  await fork.startService()
  assert.equal((await fork.workspaceStatus()).running, true)
  assert.equal((await fork.workspaceStatus()).address, '0.0.0.0')
  assert.equal((await query('child.local.test')).answers[0]?.address, '127.0.0.8')
} finally {
  if (!claimClosed) claim.close()
  await fork.stopService()
  await rm(temp, { recursive: true, force: true })
}

let running = false
let resolveStart!: () => void
let startRequests = 0
let detachments = 0
let updateSites!: (names: string[]) => void
let updateLog!: (entry: unknown) => void
const siteUpdates: unknown[] = []
const status = () => ({ running, localIP: '127.0.0.1', address: '127.0.0.1' })
const controller = new DnsServerController({
  async request(method, ...args) {
    if (method === 'workspaceConfig') return { path: 'dns.json', content: '{}', defaults: '{}' }
    if (method === 'workspaceStatus') return status()
    if (method === 'startService') {
      startRequests++
      await new Promise<void>((resolve) => {
        resolveStart = resolve
      })
      running = true
    }
    if (method === 'stopService') running = false
    if (method === 'initAppHosts') {
      siteUpdates.push(args[0])
      return true
    }
    if (method === 'saveWorkspaceConfig') return { content: args[1] }
    return undefined
  },
  interfaces: async () => [],
  watchSites: (notify) => {
    updateSites = notify
    return () => {
      detachments++
    }
  },
  watchLog: (notify) => {
    updateLog = notify
    return () => {
      detachments++
    }
  },
  reveal: async () => undefined
})
assert.equal(await controller.refresh(), true)
const start = controller.change('start')
assert.equal(await controller.change('start'), false)
assert.equal(startRequests, 1)
assert.equal(controller.busy, 'start')
resolveStart()
assert.equal(await start, true)
updateSites(['one.local'])
updateSites(['two.local'])
for (let index = 0; index < 1001; index++) updateLog({ host: '' + index, ip: '127.0.0.1', ttl: 60 })
assert.equal(controller.logs.length, 1000)
assert.equal(controller.logs[0].host, '1000')
assert.equal(await controller.refresh(), true)
assert.deepEqual(siteUpdates, [['one.local'], ['two.local']])
assert.equal(await controller.save('{"bind":"127.0.0.1"}', '{}'), true)
assert.match(controller.notice, /Restart/)
assert.equal(await controller.change('stop'), true)
assert.equal(detachments, 2)
assert.equal(controller.logs.length, 1000)
controller.clearLogs()
assert.equal(controller.logs.length, 0)
console.log(
  'DNS workspace passed: UDP bind, query, stop, restart, config persistence and controller lifecycle.'
)
