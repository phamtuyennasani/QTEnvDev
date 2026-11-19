import { join } from 'path'
import { existsSync } from 'fs'
import { Base } from '../Base'
import { I18nT } from '@lang/runtime'
import type { AppHost, SoftInstalled } from '@shared/app'
import { hostAlias, writeFile, readdir, remove, readFileByRoot, writeFileByRoot } from '../../Fn'
import { ForkPromise } from '@shared/ForkPromise'
import { makeCaddyConf, updateCaddyConf } from '../Caddy/Host'
import { makeFrankenPHPConf, updateFrankenPHPConf } from '../FrankenPHP/Host'
import { makeApacheConf, updateApacheConf } from '../Apache/Host'
import { autoFillNginxRewrite, makeNginxConf, updateNginxConf } from '../Nginx/Host'
import { setDirRole, updateAutoSSL, updateRootRule } from './Host'
import { TaskAddPhpMyAdminSite, TaskAddRandomSite } from './Task'
import type { PhpMyAdminTarget } from './PhpMyAdminProfile'
import { fetchHostList, saveHostList } from './HostFile'
import { exportWebsiteBackup, importWebsiteBackup, previewWebsiteBackup } from './WebsiteBackup'
import { parkSubdirectories } from './ParkSubdirectories'
import { validateTomcatSite, type TomcatSiteHost } from '../Tomcat/Site'
import { appDebugLog, isMacOS, isWindows } from '@shared/utils'
import { HostsFileLinux, HostsFileMacOS } from '@shared/PlatFormConst'
import { windowsSystemDirectory } from '@shared/WindowsSystemPaths'
import { reconcileSystemHostsBlock } from './SystemHostsBlock'
import { syncUnixHosts } from './UnixHosts'
import { timeOperation, timeOperationSync } from '@shared/OperationTiming'
import { launchWindowsDnsRefresh } from '@shared/WindowsDnsRefresh'
import { removeWebsiteFiles, snapshotWebsiteFiles, websitePaths } from './Transaction'

const isVhost = (host: AppHost) =>
  !['java', 'node', 'go', 'python', 'tomcat'].includes(host.type ?? '')
const websiteWriteUnknown = (error: unknown, paths: string[]) =>
  Object.assign(
    new Error(
      `The website write failed (${String(error)}). Could not restore: ${paths.join(', ')}`,
      {
        cause: error
      }
    ),
    { code: 'WEBSITE_WRITE_OUTCOME_UNKNOWN' }
  )

export class Host extends Base {
  hostsFile = ''

  constructor() {
    super()
    if (isWindows()) {
      // 构造器可能早于 Server 快照初始化，使用与 main/UAC 相同的实际系统目录。
      this.hostsFile = join(windowsSystemDirectory(), 'drivers', 'etc', 'hosts')
    } else if (isMacOS()) {
      this.hostsFile = HostsFileMacOS
    } else {
      this.hostsFile = HostsFileLinux
    }
  }

  hostList(strict = false) {
    return new ForkPromise(async (resolve, reject) => {
      let host: AppHost[] = []
      try {
        host = await fetchHostList(false)
      } catch (error) {
        if (strict) {
          reject(error)
          return
        }
      }
      resolve({
        host
      })
    })
  }

  websiteBackupExport(file: string) {
    return new ForkPromise(async (resolve) => resolve(await exportWebsiteBackup(file)))
  }

  websiteBackupPreview(file: string) {
    return new ForkPromise(async (resolve) => resolve(await previewWebsiteBackup(file)))
  }

  websiteBackupImport(file: string, token: string) {
    return new ForkPromise(async (resolve, _reject, on) => {
      resolve(await importWebsiteBackup(file, token, on))
    })
  }

  reorderHost(id: number, order: number[], action: 'up' | 'down' | 'pin' | 'unpin') {
    return new ForkPromise(async (resolve, reject) => {
      try {
        const host = await fetchHostList(false)
        if (
          !Array.isArray(order) ||
          host.length !== order.length ||
          host.some((item, index) => item.id !== order[index])
        ) {
          throw new Error('The saved website order changed. Refresh the list.')
        }
        const index = host.findIndex((item) => item.id === id)
        if (index < 0) throw new Error('The selected website was not found.')
        const selected = host[index]
        if (action === 'pin' || action === 'unpin') {
          selected.isTop = action === 'pin'
          host.splice(index, 1)
          const insert = selected.isTop ? 0 : host.findIndex((item) => !item.isTop)
          host.splice(insert < 0 ? host.length : insert, 0, selected)
        } else if (action === 'up' || action === 'down') {
          const step = action === 'up' ? -1 : 1
          let neighbor = index + step
          while (host[neighbor] && Boolean(host[neighbor].isTop) !== Boolean(selected.isTop)) {
            neighbor += step
          }
          if (!host[neighbor]) {
            resolve({ host })
            return
          }
          ;[host[index], host[neighbor]] = [host[neighbor], host[index]]
        } else {
          throw new Error('Invalid website order action.')
        }
        await saveHostList(host)
        resolve({ host })
      } catch (error) {
        reject(error)
      }
    })
  }

  handleHost(
    host: AppHost,
    flag: string,
    old?: AppHost,
    park?: boolean,
    beforeCommit?: (hosts: AppHost[]) => Promise<void>
  ) {
    return new ForkPromise<{
      host: AppHost[]
      parked?: { count: number; warnings: string[] }
      outcome?: 'unknown'
      warnings?: string[]
    }>(async (resolve) => {
      const hostList = await fetchHostList(false)
      const index = hostList.findIndex(
        (item) => String(item.id).toLowerCase() === String(host.id).toLowerCase()
      )
      const current = hostList[index]
      if (!['add', 'edit', 'del', 'park'].includes(flag)) throw new Error('Invalid website action.')
      if (flag === 'add' && current) throw new Error('The website identifier is already in use.')
      if (flag !== 'add' && (!current || current.id !== host.id)) {
        throw new Error('The selected website was not found. Refresh the list.')
      }
      if (flag === 'edit' && old?.id !== host.id) throw new Error('The website identity changed.')
      if (
        flag === 'park' &&
        (JSON.stringify(current) !== JSON.stringify(old) ||
          (current.type && current.type !== 'php'))
      ) {
        throw new Error(
          'Choose a saved PHP or static website and refresh its settings before parking.'
        )
      }

      // License check removed

      // #700: backend symmetric check — reject add/edit when another site shares
      // the same name AND any same-protocol listening port (defends against
      // bypassing the frontend validation).
      if ((flag === 'add' || flag === 'edit') && isVhost(host) && host.name) {
        const samePort = (a: AppHost, b: AppHost) => {
          const httpDup =
            a.port?.nginx === b.port?.nginx ||
            a.port?.apache === b.port?.apache ||
            a.port?.caddy === b.port?.caddy ||
            (a.port?.frankenphp ?? a.port?.caddy) === (b.port?.frankenphp ?? b.port?.caddy)
          if (httpDup) {
            return true
          }
          if (a.useSSL && b.useSSL) {
            return (
              a.port?.nginx_ssl === b.port?.nginx_ssl ||
              a.port?.apache_ssl === b.port?.apache_ssl ||
              a.port?.caddy_ssl === b.port?.caddy_ssl ||
              (a.port?.frankenphp_ssl ?? a.port?.caddy_ssl) ===
                (b.port?.frankenphp_ssl ?? b.port?.caddy_ssl)
            )
          }
          return false
        }
        const conflict = hostList.find(
          (h) =>
            (!h.type || h.type === 'php') &&
            h.name === host.name &&
            h.id !== host.id &&
            samePort(h, host)
        )
        if (conflict) {
          throw new Error(I18nT('host.samePortTips'))
        }
      }

      const base = global.Server.BaseDir!
      const legacyName = current?.name?.toLowerCase()
      const legacyOwner =
        legacyName &&
        !hostList.some(
          (item) =>
            item !== current &&
            (item.name?.toLowerCase() === legacyName ||
              String(item.id).toLowerCase() === legacyName)
        )
          ? current.name
          : undefined
      const paths = websitePaths(base, host.id, legacyOwner)
      const touched = new Map<AppHost, Awaited<ReturnType<typeof snapshotWebsiteFiles>>>()
      const uncertainPaths: string[] = []
      const cleanup = async (item: AppHost) => {
        const snapshot = touched.get(item)
        if (!snapshot) return
        touched.delete(item)
        const failures = await snapshot.restore()
        uncertainPaths.push(...failures)
        if (failures.length) throw new Error(failures.join(', '))
      }
      const removeRequired = async (files: string[]) => {
        const failures = await removeWebsiteFiles(files)
        if (failures.length)
          throw new Error(`Could not remove website configuration: ${failures.join(', ')}`)
      }
      const dropVhost = Boolean(current && isVhost(current) && (flag === 'del' || !isVhost(host)))
      let parked: Awaited<ReturnType<typeof parkSubdirectories>> | undefined
      try {
        if (flag !== 'park') {
          const writesVhost = flag !== 'del' && isVhost(host)
          const writesCertificate =
            writesVhost || dropVhost || (host.type === 'tomcat' && flag !== 'del')
          if (writesVhost || dropVhost || writesCertificate) {
            touched.set(
              host,
              await snapshotWebsiteFiles(
                writesVhost || dropVhost ? paths.configs : [],
                writesCertificate ? paths.certificate : undefined
              )
            )
          }
          if (dropVhost) await removeRequired([...paths.configs, paths.certificate])
          if (writesVhost) {
            if (
              flag === 'edit' &&
              current.useSSL === host.useSSL &&
              paths.configs.slice(0, 4).every(existsSync)
            ) {
              await this._editVhost(host, current)
            } else {
              if (flag === 'edit') {
                await removeRequired(paths.configs)
                if (!host.useSSL) await removeRequired([paths.certificate])
              }
              await this._addVhost(host)
            }
          } else if (flag !== 'del' && host.type === 'tomcat') {
            await validateTomcatSite(host as TomcatSiteHost, hostList as TomcatSiteHost[])
            await updateAutoSSL(host, current ?? ({} as AppHost))
            if (host.useSSL && (!host.ssl?.cert || !host.ssl?.key)) {
              throw new Error('Tomcat SSL requires a certificate and private key')
            }
          }
          if (flag === 'add') hostList.splice(hostList.filter((site) => site.isTop).length, 0, host)
          if (flag === 'edit') hostList[index] = host
          if (flag === 'del') hostList.splice(index, 1)
        }
        if (flag === 'park' || (park && flag !== 'del' && (!host.type || host.type === 'php'))) {
          parked = await parkSubdirectories(
            flag === 'park' ? current : host,
            hostList,
            async (item) => {
              const child = websitePaths(base, item.id)
              touched.set(item, await snapshotWebsiteFiles(child.configs, child.certificate))
              await this._addVhost(item, false)
            },
            cleanup
          )
          const insert = hostList.findIndex((site) => !site.isTop)
          hostList.splice(insert < 0 ? hostList.length : insert, 0, ...parked.added)
        }
        if (flag !== 'park' || parked?.added.length) {
          await beforeCommit?.(hostList)
          await saveHostList(hostList)
        }
      } catch (error) {
        await Promise.allSettled([...touched.keys()].map(cleanup))
        if (uncertainPaths.length) throw websiteWriteUnknown(error, uncertainPaths)
        throw error
      }

      const warnings: string[] = []
      if (flag === 'del' && dropVhost) {
        const remainingLogs = await removeWebsiteFiles(paths.logs)
        if (remainingLogs.length)
          warnings.push(`Could not remove website logs: ${remainingLogs.join(', ')}`)
      }
      resolve({
        host: hostList,
        ...(parked && { parked: { count: parked.added.length, warnings: parked.warnings } }),
        ...(uncertainPaths.length && { outcome: 'unknown' }),
        ...(warnings.length && { warnings })
      })
    })
  }

  initAllConf(host: AppHost) {
    return new ForkPromise(async (resolve) => {
      const nginxvpath = join(global.Server.BaseDir!, 'vhost/nginx')
      const apachevpath = join(global.Server.BaseDir!, 'vhost/apache')
      const caddyvpath = join(global.Server.BaseDir!, 'vhost/caddy')
      const frankenphpvpath = join(global.Server.BaseDir!, 'vhost/frankenphp')

      const confBase = `${host.id}`
      const nginxConfPath = join(nginxvpath, `${confBase}.conf`)
      const apacheConfPath = join(apachevpath, `${confBase}.conf`)
      const caddyConfPath = join(caddyvpath, `${confBase}.conf`)
      const frankenphpConfPath = join(frankenphpvpath, `${confBase}.conf`)

      if (!existsSync(nginxConfPath)) {
        await makeNginxConf(host)
      }
      if (!existsSync(apacheConfPath)) {
        await makeApacheConf(host)
      }
      if (!existsSync(caddyConfPath)) {
        await makeCaddyConf(host)
      }
      if (!existsSync(frankenphpConfPath)) {
        await makeFrankenPHPConf(host)
      }

      resolve(true)
    })
  }

  /**
   * Incremental update
   * @param host
   * @param old
   * @param addApachePort
   * @param addApachePortSSL
   * @private
   */
  _editVhost(host: AppHost, old: AppHost) {
    return new ForkPromise(async (resolve) => {
      await updateRootRule(host, old)
      await updateAutoSSL(host, old)
      if (host.useSSL && (!host.ssl?.cert || !host.ssl?.key)) {
        throw new Error('HTTPS requires a certificate and private key.')
      }
      await updateApacheConf(host, old)
      await updateNginxConf(host, old)
      await updateCaddyConf(host, old)
      await updateFrankenPHPConf(host, old)
      resolve(true)
    })
  }

  _addVhost(host: AppHost, chmod = true) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        /**
         * auto fill nginx url rewrite
         */
        autoFillNginxRewrite(host, chmod)
        await updateAutoSSL(host, {} as any)
        if (host.useSSL && (!host.ssl?.cert || !host.ssl?.key)) {
          throw new Error('HTTPS requires a certificate and private key.')
        }

        await makeCaddyConf(host)
        await makeFrankenPHPConf(host)
        await makeNginxConf(host)
        await makeApacheConf(host)
        if (chmod) {
          await setDirRole(host.root)
        }
        resolve(true)
      } catch (e) {
        console.log('_addVhost: ', e)
        reject(e)
      }
    })
  }

  _initHost(list: Array<AppHost>, writeToSystem = true, ipv6: boolean): ForkPromise<boolean> {
    return new ForkPromise(async (resolve, reject) => {
      const allHost: Set<string> = new Set<string>()
      const host: Array<string> = []
      for (const item of list) {
        const alias = hostAlias(item)
        alias.forEach((a) => {
          allHost.add(a)
        })
      }
      // localhost / loopback domains are resolved by the system already.
      // Writing them to the hosts file is redundant and forces an admin prompt.
      // Skip them so that pure localhost+port sites need no hosts write. (#700)
      const isLoopbackName = (a: string) => {
        const n = a.trim().toLowerCase()
        return n === 'localhost' || n.endsWith('.localhost') || n === '127.0.0.1' || n === '::1'
      }
      allHost.forEach((a) => {
        if (a && a.trim().length > 0 && !isLoopbackName(a)) {
          host.push(`127.0.0.1     ${a}`)
          if (ipv6) {
            host.push(`::1     ${a}`)
          }
        }
      })
      try {
        await timeOperation('hosts.write-preview', () =>
          writeFile(join(global.Server.BaseDir!, 'app.hosts.txt'), host.join('\n'))
        )
      } catch (error) {
        void appDebugLog('[Hosts][preview][error]', String(error)).catch(() => {})
      }
      if (!writeToSystem) {
        resolve(false)
        return
      }
      if (!existsSync(this.hostsFile)) {
        reject(new Error(I18nT('fork.hostsFileNotFound')))
        return
      }
      let content: string = ''
      if (!isWindows()) {
        resolve(await syncUnixHosts(host))
        return
      }
      content = (await timeOperation('hosts.read-system-file', () =>
        readFileByRoot(this.hostsFile)
      )) as string
      let x = ''
      if (host.length) {
        x = `#X-HOSTS-BEGIN#\n${host.join('\n')}\n#X-HOSTS-END#`
      }
      const result = timeOperationSync('hosts.merge-block', () =>
        reconcileSystemHostsBlock(content, x)
      )
      if (result.changed) {
        await timeOperation('hosts.write-system-file', () =>
          writeFileByRoot(this.hostsFile, result.content)
        )
      }
      resolve(result.changed)
    })
  }

  /**
   * One-time migration for #700: vhost / rewrite / log files used to be named
   * by `host.name`, which collides for same-name sites (multiple localhost).
   * They are now named by `host.id`. This regenerates id-based confs and
   * removes legacy name-based orphan files so the web servers don't load
   * duplicate `server` blocks. Guarded by a marker file; safe to no-op.
   */
  async migrateVhostToId(list: AppHost[]): Promise<void> {
    const marker = join(global.Server.BaseDir!, 'vhost/.id-migrated')
    if (existsSync(marker)) {
      return
    }
    const phpHosts = list.filter(
      (h) => !['java', 'node', 'go', 'python', 'tomcat'].includes(h?.type ?? '')
    )
    const ids = new Set(phpHosts.map((h) => `${h.id}`))

    // 1) Regenerate id-based confs for every site (idempotent).
    for (const h of phpHosts) {
      try {
        await this.initAllConf(h)
      } catch {}
    }

    // 2) Remove legacy name-based orphan files (any .conf whose base is not a known id).
    const dirs = [
      { dir: join(global.Server.BaseDir!, 'vhost/nginx'), exts: ['.conf'] },
      { dir: join(global.Server.BaseDir!, 'vhost/apache'), exts: ['.conf'] },
      { dir: join(global.Server.BaseDir!, 'vhost/caddy'), exts: ['.conf'] },
      { dir: join(global.Server.BaseDir!, 'vhost/frankenphp'), exts: ['.conf'] },
      { dir: join(global.Server.BaseDir!, 'vhost/rewrite'), exts: ['.conf'] }
    ]
    for (const { dir } of dirs) {
      if (!existsSync(dir)) {
        continue
      }
      let files: string[] = []
      try {
        files = await readdir(dir)
      } catch {
        continue
      }
      for (const f of files) {
        if (!f.endsWith('.conf')) {
          continue
        }
        const base = f.slice(0, -'.conf'.length)
        if (!ids.has(base)) {
          try {
            await remove(join(dir, f))
          } catch {}
        }
      }
    }

    // 3) Remove legacy name-based log files (keep id-based ones).
    const logDir = join(global.Server.BaseDir!, 'vhost/logs')
    if (existsSync(logDir)) {
      let logs: string[] = []
      try {
        logs = await readdir(logDir)
      } catch {}
      const idLogOk = (name: string) => {
        // id-based patterns: <id>.log, <id>.error.log, <id>.caddy.log,
        // <id>.frankenphp.log, <id>-access_log, <id>-error_log
        for (const id of ids) {
          if (
            name === `${id}.log` ||
            name === `${id}.error.log` ||
            name === `${id}.caddy.log` ||
            name === `${id}.frankenphp.log` ||
            name === `${id}-access_log` ||
            name === `${id}-error_log`
          ) {
            return true
          }
        }
        return false
      }
      for (const f of logs) {
        if (!idLogOk(f)) {
          try {
            await remove(join(logDir, f))
          } catch {}
        }
      }
    }

    try {
      await writeFile(marker, `${Date.now()}`)
    } catch {}
  }

  writeHosts(write = true, ipv6 = true) {
    return new ForkPromise(async (resolve, reject) => {
      const hostfile = join(global.Server.BaseDir!, 'host.json')
      const hasHostFile = existsSync(hostfile)

      let hasChanged = false
      let appHost: AppHost[] = []
      try {
        appHost = await timeOperation('hosts.load-site-list', () => fetchHostList())
      } catch (e) {
        reject(e)
        return
      }
      // One-time #700 migration: move vhost files from name-based to id-based.
      if (hasHostFile) {
        try {
          await timeOperation('hosts.migrate-vhosts', () => this.migrateVhostToId(appHost))
        } catch {}
      }
      console.log('writeHosts: ', write)
      if (write) {
        const changed = await this._initHost(appHost, true, ipv6)
        hasChanged = hasChanged || changed
      } else {
        if (!isWindows()) {
          hasChanged = await syncUnixHosts()
        } else {
          const hosts = await readFileByRoot(this.hostsFile)
          // 带 g 的 match 返回完整匹配数组而非捕获组，原 x[2] 会漏判删除变化，
          // 从而不刷新 DNS。复用已有协调函数，删除全部托管块并保留其他内容。
          const removal = reconcileSystemHostsBlock(hosts, '')
          if (removal.changed) {
            await writeFileByRoot(this.hostsFile, removal.content)
            hasChanged = true
          }
        }
        const changed = await this._initHost(appHost, false, ipv6)
        hasChanged = hasChanged || changed
      }
      if (hasChanged) {
        try {
          if (isWindows()) {
            // 与退出清理共用尽力启动：spawn 成功即可返回，不等待 DNS 刷新结果。
            // 启动失败只记录，不否定前面已经成功的 hosts 写入。
            // 直接普通权限执行，不再为刷新创建 PowerShell/broker 或请求新的授权。
            await timeOperation('hosts.refresh-dns-launch', () => launchWindowsDnsRefresh())
          }
        } catch (error) {
          // 共享 Windows 执行器已吸收正常启动失败；此处也防住包装层等意外异常。
          // 文件已经写入，刷新异常仅记录，不得让站点操作返回失败；不等待日志写盘。
          void appDebugLog('[Hosts][dns-refresh][error]', String(error)).catch(() => {})
        }
      }
      resolve(true)
    })
  }

  addRandomSite(version?: SoftInstalled, write = true, ipv6 = true) {
    return TaskAddRandomSite.call(this, version, write, ipv6)
  }

  addPhpMyAdminSite(phpVersion?: number, write = true, ipv6 = true) {
    return TaskAddPhpMyAdminSite.call(this, phpVersion, write, ipv6)
  }

  async configurePhpMyAdminProfile(target: PhpMyAdminTarget) {
    const { configurePhpMyAdminProfile } = await import('./PhpMyAdminProfile')
    return configurePhpMyAdminProfile(target)
  }

  getConfigFiles(_version?: SoftInstalled): Array<{ name: string; path: string }> {
    // Host 是虚拟主机管理模块，不运行独立服务，也没有固定模块级配置文件
    // （host.json / app.hosts.txt 是数据/中间文件，vhost/*.conf 与日志按站点动态生成）
    return []
  }

  getLogFiles(_version?: SoftInstalled): Array<{ name: string; path: string }> {
    // Host 模块自身不写日志，站点日志由 Nginx/Apache/Caddy/FrankenPHP 等服务生成
    return []
  }
}
export default new Host()
