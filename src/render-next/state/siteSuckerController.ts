import { reactiveBind, uuid } from '@/util/Index'
import IPC from '@/util/IPC'
import { StorageGetAsync, StorageSetAsync } from '@/util/Storage'
import { SiteOutcomeUnknown, SiteSuckerModel } from './siteSuckerModel'
import type { MirrorConfig } from '../../main/ui/SiteSucker/Policy'
const key = 'pqt-forge-site-sucker-config'
const request = (command: string, ...args: unknown[]) => new Promise<any>((resolve, reject) => {
  let requestKey: string | undefined
  let settled = false
  const finish = (error?: unknown, data?: unknown) => {
    if (settled) return
    settled = true; clearTimeout(timer)
    if (requestKey) IPC.off(requestKey)
    if (error) reject(error); else resolve(data)
  }
  const timer = setTimeout(() => finish(new SiteOutcomeUnknown('No native result received. Refresh status or stop before starting another mirror.')), 20000)
  try {
    const sent = IPC.send(command, ...args); requestKey = sent.key
    sent.then((_key: string, reply: any) => {
      if (command === 'app-sitesucker-setup') { finish(undefined, reply); return }
      if (reply?.code === 0) finish(undefined, reply.data)
      else finish(new Error(reply?.msg || `${command} failed`))
    })
  } catch (error) { finish(error) }
})
export const siteSuckerController = reactiveBind(new SiteSuckerModel({
  request,
  subscribe: (callback) => { IPC.on('App-SiteSucker-State').then((_key: string, event: any) => callback(event)); return () => IPC.off('App-SiteSucker-State') },
  load: () => StorageGetAsync<MirrorConfig>(key),
  save: (config) => StorageSetAsync(key, config),
  id: uuid
}))
