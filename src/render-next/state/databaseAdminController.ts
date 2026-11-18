import { showNotice } from './app'
import pgAdminPanel from '@/components/PostgreSql/PgAdminPanel'
import redisCommanderPanel from '@/components/Redis/RedisCommanderPanel'
import dbGatePanel from '@/components/MongoDB/DbGatePanel'
import chUiPanel from '@/components/ClickHouse/ChUiPanel'
import IPC from '@/util/IPC'
import { AppStore } from '@/store/app'
import { BrewStore } from '@/store/brew'
import { shell } from '@/util/NodeFn'
import neo4jController from '@/components/Neo4j/controller'

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
const opening = new Set<DatabaseAdminTool>()
const open = async (id: DatabaseAdminTool) => {
  if (opening.has(id)) return false
  opening.add(id)
  try {
    if (id === 'pgadmin') await pgAdminPanel.open()
    else if (id === 'redis-commander') await redisCommanderPanel.open()
    else if (id === 'dbgate') dbGatePanel.open()
    else if (id === 'ch-ui') chUiPanel.open()
    else if (id === 'neo4j-browser') await neo4jController.openBrowser()
    else await openPhpMyAdmin()
    return true
  } catch (error) {
    showNotice(error instanceof Error ? error.message : String(error))
    return false
  } finally { opening.delete(id) }
}
export const databaseAdminController = {
  actions,
  open,
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
async function request(method: string, ...args: unknown[]) {
  return new Promise<any>((resolve, reject) => {
    IPC.send('app-fork:host', method, ...args).then((key: string, response: any) => {
      if (response?.code === 200) return
      IPC.off(key)
      response?.code === 0 ? resolve(response.data) : reject(new Error(response?.msg ?? 'phpMyAdmin operation failed'))
    })
  })
}
async function openPhpMyAdmin() {
  const store = AppStore()
  const existing = store.hosts.find((host: any) => host.isAppPHPMyAdmin === true)
  if (!existing) {
    const versions = BrewStore().module('php').installed.filter((item: any) => item.version && item.num)
    const latest = [...versions].sort((a: any, b: any) => (a.num ?? 0) - (b.num ?? 0)).pop()
    await request('addPhpMyAdminSite', latest?.num, store.config.setup?.hosts?.write ?? true, store.config.setup?.hosts?.ipv6 ?? true)
    await store.initHost()
  }
  const host: any = store.hosts.find((item: any) => item.isAppPHPMyAdmin === true)
  if (!host) throw new Error('phpMyAdmin host was not created.')
  const running = BrewStore().module('nginx').installed.find((item: any) => item.run) || BrewStore().module('apache').installed.find((item: any) => item.run) || BrewStore().module('caddy').installed.find((item: any) => item.run)
  const ssl = host.useSSL
  const type = running?.typeFlag
  const port = ssl ? (type ? host.port?.[type + '_ssl'] : 443) : (type ? host.port?.[type] : 80)
  await shell.openExternal((ssl ? 'https://' : 'http://') + host.name + (port === 80 || port === 443 ? '' : ':' + port))
}
