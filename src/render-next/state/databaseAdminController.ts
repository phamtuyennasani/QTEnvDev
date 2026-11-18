import { showNotice } from './app'
import pgAdminPanel from '@/components/PostgreSql/PgAdminPanel'
import redisCommanderPanel from '@/components/Redis/RedisCommanderPanel'
import dbGatePanel from '@/components/MongoDB/DbGatePanel'
import chUiPanel from '@/components/ClickHouse/ChUiPanel'

export type DatabaseAdminTool = 'pgadmin' | 'redis-commander' | 'dbgate' | 'ch-ui'
export type DatabaseAdminAction = { id: DatabaseAdminTool; label: string; database: string }

const actions: DatabaseAdminAction[] = [
  { id: 'pgadmin', label: 'Open pgAdmin 4', database: 'PostgreSQL' },
  { id: 'redis-commander', label: 'Open Redis Commander', database: 'Redis' },
  { id: 'dbgate', label: 'Open DbGate', database: 'MongoDB' },
  { id: 'ch-ui', label: 'Open CH-UI', database: 'ClickHouse' }
]
const opening = new Set<DatabaseAdminTool>()
const open = async (id: DatabaseAdminTool) => {
  if (opening.has(id)) return false
  opening.add(id)
  try {
    if (id === 'pgadmin') await pgAdminPanel.open()
    else if (id === 'redis-commander') await redisCommanderPanel.open()
    else if (id === 'dbgate') dbGatePanel.open()
    else chUiPanel.open()
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
    return chUiPanel.opening.value
  }
}
