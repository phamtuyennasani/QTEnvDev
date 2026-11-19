import { reactiveBind, uuid } from '@/util/Index'
import IPC from '@/util/IPC'
import { StorageGetAsync, StorageSetAsync } from '@/util/Storage'
import localForage from 'localforage'
import { SetupStore } from '@/components/Setup/store'
import { CapturerOperation, CapturerOutcomeUnknown } from './CapturerOperation'
const request = (command: string, ...args: unknown[]) => new Promise<any>((resolve, reject) => {
  const sent = IPC.send(command, ...args)
  const timer = setTimeout(() => { IPC.off(sent.key); reject(new CapturerOutcomeUnknown('The native capture command did not reply. Check status before retrying.')) }, 15000)
  sent.then((key: string, response: any) => {
    clearTimeout(timer); IPC.off(key)
    if (response?.code === 1) reject(new Error(response.msg || command + ' failed'))
    else resolve(response?.code === 0 ? response.data : response)
  })
})
export const capturerController = reactiveBind(new CapturerOperation({
  load: () => StorageGetAsync('pqt-forge-capturer-config'),
  legacy: () => localForage.getItem('qtenvdev-capturer-setup'),
  save: (config) => StorageSetAsync('pqt-forge-capturer-config', config),
  request,
  subscribe(callback) { IPC.on('App-Capturer-State').then((_key: string, event: any) => callback(event)); return () => IPC.off('App-Capturer-State') },
  id: uuid, now: () => Math.floor(Date.now() / 1000), active: () => SetupStore().isActive
}))
