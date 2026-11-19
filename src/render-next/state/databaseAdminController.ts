import { showNotice } from './app'
import pgAdminPanel from '@/components/PostgreSql/PgAdminPanel'
import redisCommanderPanel from '@/components/Redis/RedisCommanderPanel'
import dbGatePanel from '@/components/MongoDB/DbGatePanel'
import chUiPanel from '@/components/ClickHouse/ChUiPanel'
import { reactive } from 'vue'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'
import { AppStore, type AppHost } from '@/store/app'
import { BrewStore } from '@/store/brew'
import neo4jController from '@/components/Neo4j/controller'
import type { ModuleInstalledItem } from '@/core/Module/ModuleInstalledItem'

export type DatabaseAdminTool = 'pgadmin' | 'redis-commander' | 'dbgate' | 'ch-ui' | 'phpmyadmin' | 'neo4j-browser'
export type DatabaseAdminAction = { id: DatabaseAdminTool; label: string; database: string }

const actions: DatabaseAdminAction[] = [
  { id: 'pgadmin', label: 'Open pgAdmin 4', database: 'PostgreSQL' },
  { id: 'redis-commander', label: 'Open Redis Commander', database: 'Redis' },
  { id: 'dbgate', label: 'Open DbGate', database: 'MongoDB' },
  { id: 'ch-ui', label: 'Open CH-UI', database: 'ClickHouse' }
  ,{ id: 'phpmyadmin', label: 'Open phpMyAdmin', database: 'MySQL' }
  ,{ id: 'phpmyadmin', label: 'Open phpMyAdmin', database: 'MariaDB' }
  ,{ id: 'neo4j-browser', label: 'Open Neo4j Browser', database: 'Neo4j' }
]
type DatabaseEngine = 'mysql' | 'mariadb'
const opening = reactive(new Set<DatabaseAdminTool>())
const phpMyAdminStatus = reactive({ progress: undefined as number | undefined, message: '' })
const open = async (id: DatabaseAdminTool, engine?: DatabaseEngine, version?: ModuleInstalledItem) => {
  if (opening.has(id)) return false
  opening.add(id)
  try {
    if (id === 'pgadmin') await pgAdminPanel.open()
    else if (id === 'redis-commander') await redisCommanderPanel.open()
    else if (id === 'dbgate') dbGatePanel.open()
    else if (id === 'ch-ui') chUiPanel.open()
    else if (id === 'neo4j-browser') await neo4jController.openBrowser()
    else {
      phpMyAdminStatus.progress = undefined
      phpMyAdminStatus.message = ''
      await openPhpMyAdmin(engine, version)
    }
    return true
  } catch (error) {
    showNotice(error instanceof Error ? error.message : String(error))
    return false
  } finally { opening.delete(id); if (id === 'phpmyadmin') phpMyAdminStatus.progress = undefined }
}
export const databaseAdminController = {
  actions,
  open,
  phpMyAdminStatus,
  isOpening: (id: DatabaseAdminTool) => {
    if (opening.has(id)) return true
    if (id === 'pgadmin') return pgAdminPanel.opening.value
    if (id === 'redis-commander') return redisCommanderPanel.opening.value
    if (id === 'dbgate') return dbGatePanel.opening.value
    if (id === 'ch-ui') return chUiPanel.opening.value
    if (id === 'neo4j-browser') return neo4jController.opening.value
    return opening.has(id)
  }
}
const setupTimeout = 'phpMyAdmin site setup did not report a result. Its site will be checked before retrying.'
let siteSetupUnknown = false

async function request(channel: string, args: unknown[], timeoutMs = 60_000, onProgress?: (event: any) => void) {
  const response = await forkTerminalRequest(channel, args, onProgress ? setupTimeout : 'The phpMyAdmin request timed out.', timeoutMs, onProgress)
  if (response.code !== 0) throw new Error(response.msg || 'The phpMyAdmin request failed.')
  return response.data
}

async function readPhpMyAdminHost() {
  const catalog = await request('app-fork:host', ['hostList', true])
  if (!Array.isArray(catalog?.host)) throw new Error('The website list could not be loaded.')
  return (catalog.host as AppHost[]).find((host) => host.isAppPHPMyAdmin === true)
}

async function openPhpMyAdmin(engine?: DatabaseEngine, selection?: ModuleInstalledItem) {
  if (!engine) throw new Error('Select MySQL or MariaDB before opening phpMyAdmin.')
  const store = AppStore()
  const brew = BrewStore()
  const database = brew.module(engine)
  if (!(await database.fetchInstalled())) throw new Error('Could not load the installed database versions.')
  const item = selection ? database.installed.find((entry) => entry.bin === selection.bin && entry.version === selection.version) :
    database.installed.find((entry) => entry.run) ?? brew.currentVersion(engine) ?? database.installed[0]
  if (!item?.version || !item.bin || !item.run) throw new Error('Start the selected database version before opening phpMyAdmin.')
  const snapshot = { version: item.version, bin: item.bin }
  const endpoint = await request(`app-fork:${engine}`, ['databaseConnectionEndpoint', snapshot])
  if (!Number.isInteger(endpoint?.port) || endpoint.port < 1 || endpoint.port > 65535) throw new Error('The selected database did not report a local TCP port.')
  const webServers = ['nginx', 'apache', 'caddy'] as const
  const checked = await Promise.allSettled(webServers.map((flag) => brew.module(flag).fetchInstalled()))
  const server = webServers.find((flag) => brew.module(flag).installed.some((entry) => entry.run))
  if (!server && checked.some((result) => result.status === 'rejected' || !result.value)) {
    throw new Error('Could not confirm a running web server for phpMyAdmin.')
  }
  if (!server) throw new Error('Start Nginx, Apache or Caddy before opening phpMyAdmin.')
  let host = await readPhpMyAdminHost()
  if (host) siteSetupUnknown = false
  const warnings: string[] = []
  if (!host) {
    if (siteSetupUnknown) throw new Error(setupTimeout)
    const php = brew.module('php')
    if (!(await php.fetchInstalled())) throw new Error('Could not load the installed PHP versions.')
    const latest = [...php.installed].filter((entry) => entry.version && entry.num)
      .sort((a, b) => (b.num ?? 0) - (a.num ?? 0))[0]
    if (!latest?.num) throw new Error('Install PHP before setting up phpMyAdmin.')
    phpMyAdminStatus.progress = 0
    try {
      const result = await request('app-fork:host', ['addPhpMyAdminSite', latest.num, store.config.setup?.hosts?.write ?? true, store.config.setup?.hosts?.ipv6 ?? true], 360_000, (event) => {
        if (typeof event.msg === 'number' && Number.isFinite(event.msg)) phpMyAdminStatus.progress = event.msg
      })
      if (Array.isArray(result?.warnings)) warnings.push(...result.warnings)
    } catch (error) {
      if (error instanceof Error && error.message === setupTimeout) siteSetupUnknown = true
      throw error
    }
    host = await readPhpMyAdminHost()
    if (!host) throw new Error('The phpMyAdmin setup completed but the site could not be located.')
  }
  const port = host.useSSL ? host.port[`${server}_ssl`] : host.port[server]
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !/^[a-z\d.-]+$/i.test(host.name)) {
    throw new Error('The managed phpMyAdmin site did not report a valid web address.')
  }
  const version = /^\d+(?:\.\d+){1,3}/.exec(snapshot.version)?.[0] ?? ''
  const profile = await request('app-fork:host', ['configurePhpMyAdminProfile', { engine, version, port: endpoint.port }])
  if (!Number.isInteger(profile?.server) || profile.server !== 65536 + endpoint.port) throw new Error('phpMyAdmin did not confirm the selected database profile.')
  const url = new URL(`${host.useSSL ? 'https' : 'http'}://${host.name}:${port}/`)
  url.searchParams.set('server', String(profile.server))
  try {
    await request('App-Node-FN', ['shell', 'openExternalChecked', url.href], 20_000)
  } catch (error) {
    phpMyAdminStatus.message = `The database profile is ready. Open ${url.href} in your browser.`
    throw new Error([...warnings, phpMyAdminStatus.message, error instanceof Error ? error.message : String(error)].join(' '))
  }
  const message = `phpMyAdmin opened for ${engine === 'mysql' ? 'MySQL' : 'MariaDB'} ${version} on port ${endpoint.port}. Use Import to restore a backup or User accounts to manage access.`
  phpMyAdminStatus.message = [message, ...warnings].join(' ')
  showNotice(phpMyAdminStatus.message)
}
