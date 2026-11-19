import { computed, reactive } from 'vue'
import { isBuiltinModuleVisible } from '../moduleVisibility/visibility'
import { databaseModuleFlags, refreshDatabase } from '../adapters/databaseAdapter'

export type DatabaseItem = { name: string; engine: string; version: string; state: 'running' | 'stopped' | 'not-installed' | 'warning' | 'unknown' | 'unavailable'; storage: string; connections?: number }
const databases = reactive<DatabaseItem[]>(Object.keys(databaseModuleFlags).map((name) => ({ name, engine: 'Database module', version: '—', state: 'unknown', storage: '—' })))
const visibleDatabases = computed(() => databases.filter((database) => isBuiltinModuleVisible(databaseModuleFlags[database.name])))
const selected = reactive<{ database?: DatabaseItem }>({ database: databases[0] })
const refresh = async () => {
  await Promise.all(visibleDatabases.value.map(async (database) => {
    const result = await refreshDatabase(database.name)
    if (!result.connected) { database.state = result.reason === 'unavailable' ? 'unavailable' : 'unknown'; database.version = '—'; database.connections = undefined; database.storage = '—'; return }
    database.state = !result.installed ? 'not-installed' : result.running ? 'running' : 'stopped'
    database.version = result.version || '—'
  }))
}
export const databaseController = { databases, visibleDatabases, selected, runningCount: computed(() => visibleDatabases.value.filter((item) => item.state === 'running').length), select(database: DatabaseItem) { selected.database = database }, refresh }
