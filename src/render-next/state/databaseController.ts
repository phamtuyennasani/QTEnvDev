import { computed, reactive } from 'vue'
import { refreshDatabase } from '../adapters/databaseAdapter'

export type DatabaseItem = { name: string; engine: string; version: string; port: number; state: 'running' | 'stopped' | 'warning'; storage: string; connections: number }
const databases = reactive<DatabaseItem[]>([
  { name: 'MySQL', engine: 'Relational database', version: '—', port: 3306, state: 'stopped', storage: '—', connections: 0 },
  { name: 'PostgreSQL', engine: 'Relational database', version: '—', port: 5432, state: 'stopped', storage: '—', connections: 0 },
  { name: 'Redis', engine: 'In-memory store', version: '—', port: 6379, state: 'stopped', storage: '—', connections: 0 },
  { name: 'MongoDB', engine: 'Document database', version: '—', port: 27017, state: 'stopped', storage: '—', connections: 0 }, { name: 'MariaDB', engine: 'SQL database', version: '—', port: 3307, state: 'stopped', storage: '—', connections: 0 }, { name: 'ClickHouse', engine: 'Analytics database', version: '—', port: 8123, state: 'stopped', storage: '—', connections: 0 }, { name: 'Neo4j', engine: 'Graph database', version: '—', port: 7474, state: 'stopped', storage: '—', connections: 0 }, { name: 'Elasticsearch', engine: 'Search database', version: '—', port: 9200, state: 'stopped', storage: '—', connections: 0 }, { name: 'Qdrant', engine: 'Vector database', version: '—', port: 6333, state: 'stopped', storage: '—', connections: 0 }
])
const selected = reactive<{ database?: DatabaseItem }>({ database: databases[0] })
const refresh = async () => {
  await Promise.all(databases.map(async (database) => {
    const result = await refreshDatabase(database.name)
    if (!result.connected) { database.state = 'warning'; return }
    database.state = !result.installed ? 'stopped' : result.running ? 'running' : 'stopped'
    database.version = result.version || '—'
  }))
}
export const databaseController = { databases, selected, runningCount: computed(() => databases.filter((item) => item.state === 'running').length), select(database: DatabaseItem) { selected.database = database }, refresh }
