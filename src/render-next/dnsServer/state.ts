import { watch } from 'vue'
import IPC from '@/util/IPC'
import { reactiveBind } from '@/util/Index'
import { ip, shell } from '@/util/NodeFn'
import { AppStore } from '@/store/app'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'
import { ensureDataDirectoryReady } from '@/core/DataDirectoryStartup'
import { buildSiteHostnames } from '@shared/siteRuntime'
import { DnsServerController } from './Controller'

export const dnsServer = reactiveBind(
  new DnsServerController({
    async request(method, ...args) {
      if (!(await ensureDataDirectoryReady()))
        throw new Error('The application data directory is unavailable.')
      const reply = await forkTerminalRequest(
        'app-fork:dns',
        [method, ...args],
        'The DNS fork did not report its result.',
        method === 'startService' || method === 'stopService' ? 360_000 : 60_000
      )
      if (reply.code !== 0) throw new Error(reply.msg || 'DNS operation failed.')
      return reply.data
    },
    interfaces: ip.addressList,
    watchSites: (update) =>
      watch(
        () => JSON.stringify([...new Set(AppStore().hosts.flatMap(buildSiteHostnames))]),
        (names) => update(JSON.parse(names)),
        { immediate: true }
      ),
    watchLog(update) {
      IPC.on('App_DNS_Log').then((_key, entry) => update(entry))
      return () => IPC.off('App_DNS_Log')
    },
    reveal: (path) => shell.showItemInFolder(path)
  })
)
