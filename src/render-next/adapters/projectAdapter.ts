import IPC from '@/util/IPC'
import { AppStore } from '@/store/app'
import { HostStore } from '@/components/Host/store'
import { BrewStore } from '@/store/brew'
import { fs, shell, dialog } from '@/util/NodeFn'
import { ensureDataDirectoryReady } from '@/core/DataDirectoryStartup'
import {
  WebsiteOutcomeUnknown,
  websiteError,
  type WebsiteDependencies,
  type WebsiteHost
} from '../websites/types'
import { showNotice } from '../state/app'
import { registerLifecycle } from './lifecycleAdapter'
import { isTomcatSite } from '@shared/siteRuntime'
import tomcatSiteController from '@/components/Host/Tomcat/TomcatSiteController'
import { cloneTomcatSiteHost, rendererTomcatNameError } from '@/components/Host/Tomcat/site'
import { tomcatCatalinaBase, TomcatSetup } from '@/components/Tomcat/setup'
import { dirname, basename, join } from '@/util/path-browserify'

function request(
  method: string,
  args: unknown[],
  mutation = false,
  progress?: (message: string) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const sent = IPC.send('app-fork:host', method, ...args)
    const timer = setTimeout(
      () => {
        IPC.off(sent.key)
        reject(
          mutation
            ? new WebsiteOutcomeUnknown(
                'The write has not reported its result. Refresh hosts before retrying.'
              )
            : new Error('The host request timed out.')
        )
      },
      mutation ? 360000 : 60000
    )
    sent.then((key, reply) => {
      if (reply?.code === 200) {
        progress?.(typeof reply.msg === 'string' ? reply.msg : 'Updating website configuration…')
        return
      }
      clearTimeout(timer)
      IPC.off(key)
      if (reply?.code === 0) resolve(reply.data)
      else if (mutation && reply?.errorCode === 'WEBSITE_WRITE_OUTCOME_UNKNOWN') {
        reject(
          new WebsiteOutcomeUnknown(
            typeof reply?.msg === 'string' ? reply.msg : 'The website write could not be verified.'
          )
        )
      } else
        reject(new Error(typeof reply?.msg === 'string' ? reply.msg : 'Website operation failed.'))
    })
  })
}
const hostList = (data: any): WebsiteHost[] => {
  if (data?.hostBackFile)
    throw new Error('The host file could not be parsed. Backup: ' + data.hostBackFile)
  if (!Array.isArray(data?.host))
    throw new Error('The backend did not return an authoritative host list.')
  return data.host
}
export const websiteDependencies: WebsiteDependencies = {
  ready: () => Boolean(window.QTEnvDevNodeAPI && window.Server?.BaseDir),
  async list() {
    return hostList(await request('hostList', [true]))
  },
  async reorder(id, order, action) {
    if (!(await ensureDataDirectoryReady()))
      throw new Error('The application data directory is not ready.')
    const result = await request('reorderHost', [id, order, action], true)
    try {
      return hostList(result)
    } catch {
      throw new WebsiteOutcomeUnknown('The website order could not be verified after saving.')
    }
  },
  async validate(host) {
    if (!(await ensureDataDirectoryReady()))
      throw new Error('The application data directory is not ready.')
    if (!(await fs.existsSync(host.root))) throw new Error('The website root does not exist.')
    const stat = (await fs.stat(host.root)) as unknown as { isDirectory?: boolean }
    if (stat?.isDirectory !== true) throw new Error('Choose a directory as the website root.')
    if (host.useSSL && !host.autoSSL)
      for (const file of [host.ssl.cert, host.ssl.key])
        if (!(await fs.existsSync(file))) throw new Error('SSL file does not exist: ' + file)
  },
  async write(host, action, old, progress, includeSubdirectories) {
    if (isTomcatSite(host)) {
      if (action === 'park') throw new Error('Subdirectory sites require a PHP or static website.')
      const item = cloneTomcatSiteHost(host)
      const previous = old ? cloneTomcatSiteHost(old) : undefined
      if (
        !(await tomcatSiteController.save(
          item as WebsiteHost,
          action,
          previous as WebsiteHost | undefined
        ))
      ) {
        const message = tomcatSiteController.error || 'The Tomcat website change did not complete.'
        if (tomcatSiteController.phase === 'unknown') throw new WebsiteOutcomeUnknown(message)
        throw new Error(message)
      }
      const result = tomcatSiteController.committed
      if (!result)
        throw new WebsiteOutcomeUnknown(
          'The Tomcat website list could not be verified after the write.'
        )
      return {
        hosts: hostList(result),
        warnings: tomcatSiteController.warning?.split('\n') ?? []
      }
    }
    if (!(await ensureDataDirectoryReady()))
      throw new Error('The application data directory is not ready.')
    const result = await request(
      'handleHost',
      [host, action, old || {}, Boolean(includeSubdirectories)],
      true,
      progress
    )
    try {
      const hosts = hostList(result)
      if (action !== 'park' && !includeSubdirectories) return hosts
      const { count, warnings } = result.parked ?? { count: 0, warnings: [] }
      const added =
        count === 1 ? '1 subdirectory website added.' : count + ' subdirectory websites added.'
      return {
        hosts,
        warnings,
        message:
          (action === 'park' ? '' : 'Website configuration saved. ') +
          (count ? added : 'No subdirectory websites added.'),
        sync: action !== 'park' || count > 0
      }
    } catch (error) {
      throw new WebsiteOutcomeUnknown(
        'The backend reported completion, but its host list could not be verified: ' +
          websiteError(error)
      )
    }
  },
  reconcile(hosts) {
    AppStore().UPDATE_HOSTS(hosts)
    HostStore.updateCurrentList()
  },
  async afterCommit() {
    const warnings: string[] = []
    try {
      const settings = AppStore().config.setup.hosts
      const result = await request('writeHosts', [settings.write, settings.ipv6 !== false])
      if (result !== true) warnings.push('System hosts synchronization was not confirmed.')
    } catch (error) {
      warnings.push('System hosts: ' + websiteError(error))
    }
    for (const flag of ['nginx', 'apache', 'caddy', 'frankenphp', 'tomcat']) {
      try {
        await registerLifecycle(flag)
        for (const version of BrewStore()
          .module(flag)
          .installed.filter((item) => item.run)) {
          if (version.running) {
            warnings.push(
              flag +
                ': another service operation is in progress. Restart it after that operation completes.'
            )
            continue
          }
          try {
            const result = await version.restart()
            if (result !== true) warnings.push(flag + ' reload: ' + String(result))
          } catch (error) {
            warnings.push(flag + ' reload: ' + websiteError(error))
          }
        }
      } catch (error) {
        warnings.push(flag + ' reload: ' + websiteError(error))
      }
    }
    return warnings
  },
  open: (url) => shell.openExternal(url),
  async choosePath(file, current) {
    const result = await dialog.showOpenDialog({
      properties: [file ? 'openFile' : 'openDirectory', 'showHiddenFiles'],
      ...(current ? { defaultPath: current } : {})
    })
    return result.canceled ? undefined : result.filePaths[0]
  },
  async reveal(path) {
    if (!(await fs.existsSync(path))) throw new Error('This file has not been created yet.')
    await shell.showItemInFolder(path)
  },
  async logFiles(id, host) {
    const directory = join(window.Server.BaseDir!, 'vhost/logs')
    if (isTomcatSite(host)) {
      if (!(await fs.existsSync(directory))) return []
      const prefix = host.name + '-tomcat_access_log'
      const dateSuffix = /^\.\d{4}-\d{2}-\d{2}\.log$/
      return (await fs.readdir(directory, false))
        .filter((file) => {
          if (!file.startsWith(prefix)) return false
          const suffix = file.slice(prefix.length)
          return suffix === '' || suffix === '.log' || dateSuffix.test(suffix)
        })
        .sort((left, right) => right.localeCompare(left))
        .map((file) => ({ label: file, path: join(directory, file) }))
    }
    return [
      ['Nginx access', id + '.log'],
      ['Nginx errors', id + '.error.log'],
      ['Apache access', id + '-access_log'],
      ['Apache errors', id + '-error_log'],
      ['Caddy', id + '.caddy.log'],
      ['FrankenPHP', id + '.frankenphp.log']
    ].map(([label, file]) => ({ label, path: join(directory, file) }))
  },
  async vhostFiles(id, host) {
    if (isTomcatSite(host)) {
      const store = BrewStore()
      const version =
        store.module('tomcat').installed.find((item) => item.run) ?? store.currentVersion('tomcat')
      if (!version) return []
      await TomcatSetup.init()
      const conf = join(tomcatCatalinaBase(version), 'conf')
      const files = [{ label: 'server.xml', path: join(conf, 'server.xml'), readOnly: true }]
      if (host.tomcat?.rewrite?.enabled && !rendererTomcatNameError(host.name)) {
        files.push({
          label: 'rewrite.config',
          path: join(conf, 'Catalina', host.name, 'rewrite.config'),
          readOnly: true
        })
      }
      return files
    }
    const directory = join(window.Server.BaseDir!, 'vhost')
    return [
      ['Nginx', 'nginx'],
      ['Apache', 'apache'],
      ['Caddy', 'caddy'],
      ['FrankenPHP', 'frankenphp'],
      ['Rewrite', 'rewrite']
    ].map(([label, section]) => ({ label, path: join(directory, section, id + '.conf') }))
  },
  async afterFileSave(path) {
    const section = basename(dirname(path))
    const flag = section === 'rewrite' ? 'nginx' : section
    if (flag !== 'nginx' && flag !== 'apache' && flag !== 'caddy' && flag !== 'frankenphp')
      return []
    const results = await Promise.allSettled(
      BrewStore()
        .module(flag)
        .installed.filter((item) => item.run)
        .map(async (version) => {
          if (version.running) throw new Error('Another service operation is in progress.')
          const result = await version.restart()
          if (result !== true)
            throw new Error(typeof result === 'string' ? result : 'Restart was not confirmed.')
        })
    )
    return results.flatMap((result) =>
      result.status === 'rejected' ? [flag + ' restart: ' + websiteError(result.reason)] : []
    )
  },
  notice: showNotice
}
