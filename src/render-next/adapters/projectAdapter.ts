import IPC from '@/util/IPC'
import { AppStore } from '@/store/app'
import { HostStore } from '@/components/Host/store'
import { BrewStore } from '@/store/brew'
import { fs, shell, dialog } from '@/util/NodeFn'
import { ensureDataDirectoryReady } from '@/core/DataDirectoryStartup'
import { WebsiteOutcomeUnknown, websiteError, type WebsiteDependencies, type WebsiteHost } from '../websites/types'
import { showNotice } from '../state/app'
import { registerLifecycle } from './lifecycleAdapter'

function request(method: string, args: unknown[], mutation = false, progress?: (message: string) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const sent = IPC.send('app-fork:host', method, ...args)
    const timer = setTimeout(() => { IPC.off(sent.key); reject(mutation ? new WebsiteOutcomeUnknown('The write has not reported its result. Refresh hosts before retrying.') : new Error('The host request timed out.')) }, mutation ? 360000 : 60000)
    sent.then((key, reply) => {
      if (reply?.code === 200) { progress?.(typeof reply.msg === 'string' ? reply.msg : 'Updating website configuration…'); return }
      clearTimeout(timer); IPC.off(key)
      if (reply?.code === 0) resolve(reply.data)
      else reject(new Error(typeof reply?.msg === 'string' ? reply.msg : 'Website operation failed.'))
    })
  })
}
const hostList = (data: any): WebsiteHost[] => {
  if (data?.hostBackFile) throw new Error('The host file could not be parsed. Backup: ' + data.hostBackFile)
  if (!Array.isArray(data?.host)) throw new Error('The backend did not return an authoritative host list.')
  return data.host
}
export const websiteDependencies: WebsiteDependencies = {
  ready: () => Boolean(window.QTEnvDevNodeAPI && window.Server?.BaseDir),
  async list() { return hostList(await request('hostList', [])) },
  async validate(host) {
    if (!await ensureDataDirectoryReady()) throw new Error('The application data directory is not ready.')
    if (!await fs.existsSync(host.root)) throw new Error('The website root does not exist.')
    const stat = await fs.stat(host.root) as unknown as { isDirectory?: boolean }
    if (stat?.isDirectory !== true) throw new Error('Choose a directory as the website root.')
    if (host.useSSL && !host.autoSSL) for (const file of [host.ssl.cert, host.ssl.key]) if (!await fs.existsSync(file)) throw new Error('SSL file does not exist: ' + file)
  },
  async write(host, action, old, progress) {
    if (!await ensureDataDirectoryReady()) throw new Error('The application data directory is not ready.')
    const result = await request('handleHost', [host, action, old || {}, false], true, progress)
    try { return hostList(result) } catch (error) { throw new WebsiteOutcomeUnknown('The backend reported completion, but its host list could not be verified: ' + websiteError(error)) }
  },
  reconcile(hosts) { AppStore().UPDATE_HOSTS(hosts); HostStore.updateCurrentList() },
  async afterCommit() {
    const warnings: string[] = []
    try {
      const settings = AppStore().config.setup.hosts
      const result = await request('writeHosts', [settings.write, settings.ipv6 !== false])
      if (result !== true) warnings.push('System hosts synchronization was not confirmed.')
    } catch (error) { warnings.push('System hosts: ' + websiteError(error)) }
    for (const flag of ['nginx', 'apache', 'caddy', 'frankenphp', 'tomcat']) {
      try {
        await registerLifecycle(flag)
        for (const version of BrewStore().module(flag).installed.filter((item) => item.run)) {
          if (version.running) { warnings.push(flag + ': another service operation is in progress. Restart it after that operation completes.'); continue }
          try { const result = await version.restart(); if (result !== true) warnings.push(flag + ' reload: ' + String(result)) }
          catch (error) { warnings.push(flag + ' reload: ' + websiteError(error)) }
        }
      } catch (error) { warnings.push(flag + ' reload: ' + websiteError(error)) }
    }
    return warnings
  },
  open: (url) => shell.openExternal(url),
  async choosePath(file, current) {
    const result = await dialog.showOpenDialog({ properties: [file ? 'openFile' : 'openDirectory', 'showHiddenFiles'], ...(current ? { defaultPath: current } : {}) })
    return result.canceled ? undefined : result.filePaths[0]
  },
  async reveal(path) { if (!await fs.existsSync(path)) throw new Error('This file has not been created yet.'); await shell.showItemInFolder(path) },
  logFiles(id) { return [['Nginx access', String(id) + '.log'], ['Nginx errors', String(id) + '.error.log'], ['Apache access', String(id) + '-access_log'], ['Apache errors', String(id) + '-error_log'], ['Caddy', String(id) + '.caddy.log'], ['FrankenPHP', String(id) + '.frankenphp.log']].map(([label, file]) => ({ label, path: String(window.Server.BaseDir) + '/vhost/logs/' + file })) },
  vhostFiles(id) { const base = String(window.Server.BaseDir); return [['Nginx', 'nginx/' + id + '.conf'], ['Apache', 'apache/' + id + '.conf'], ['Caddy', 'caddy/' + id + '.conf'], ['FrankenPHP', 'frankenphp/' + id + '.conf'], ['Rewrite', 'rewrite/' + id + '.conf']].map(([label, file]) => ({ label, path: base + '/vhost/' + file })) },
  notice: showNotice
}
