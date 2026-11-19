import { reactiveBind } from '@/util/Index'
import { shell } from '@/util/NodeFn'
import { MySQLManage, type MySQLDatabaseItem } from '@/components/Mysql/Manage/manage'
import { currentServiceVersion } from '../adapters/serviceAdapter'
import { showNotice } from './app'

export type DatabaseConnection = { name: string; version?: string; bin?: string; host: string; port?: number; user: string; password: string; dataDirectory?: string }
const defaultPorts: Record<string, number> = { MySQL: 3306, MariaDB: 3306, PostgreSQL: 5432, Redis: 6379, MongoDB: 27017, ClickHouse: 8123, Neo4j: 7687, Elasticsearch: 9200, Qdrant: 6333 }
class DatabaseToolsController {
  connection?: DatabaseConnection
  databases: MySQLDatabaseItem[] = []
  loading = false
  saving = false
  error = ''
  private flight?: Promise<boolean>
  private version(name: string) { return currentServiceVersion(name) }
  async load(name: string): Promise<boolean> {
    if (this.flight) return this.flight
    this.loading = true; this.error = ''
    const flight = Promise.resolve().then(async () => {
      const item: any = this.version(name)
      const isMysql = name === 'MySQL' || name === 'MariaDB'
      if (isMysql) MySQLManage.init(name === 'MySQL' ? 'mysql' : 'mariadb')
      this.connection = { name, version: item?.version, bin: item?.bin, host: '127.0.0.1', port: defaultPorts[name], user: isMysql ? 'root' : '—', password: isMysql ? (item?.rootPassword || 'root') : '—', dataDirectory: item?.dataDir || item?.dataPath }
      if (isMysql && item) this.databases = await MySQLManage.fetchDatabase(item)
      else this.databases = []
      return true
    }).catch((error) => { this.error = error instanceof Error ? error.message : String(error); showNotice(this.error); return false }).finally(() => { this.loading = false; this.flight = undefined })
    this.flight = flight; return flight
  }
  async changePassword(password: string): Promise<boolean> {
    const connection = this.connection; if (!connection || !connection.bin || !password || (connection.name !== 'MySQL' && connection.name !== 'MariaDB')) return false
    this.saving = true; this.error = ''
    try { const item: any = this.version(connection.name); if (!item) throw new Error('No installed database version is selected.'); const ok = await MySQLManage.passwordChange(item, connection.user, password); if (!ok) throw new Error('The database password was not changed.'); connection.password = password; showNotice('Database credentials updated.'); return true }
    catch (error) { this.error = error instanceof Error ? error.message : String(error); showNotice(this.error); return false }
    finally { this.saving = false }
  }
  async revealDataDirectory(): Promise<boolean> {
    const path = this.connection?.dataDirectory; if (!path) { this.error = 'This module did not report a data directory.'; showNotice(this.error); return false }
    try { await shell.showItemInFolder(path); return true } catch (error) { this.error = error instanceof Error ? error.message : String(error); showNotice(this.error); return false }
  }
}
export const databaseToolsController = reactiveBind(new DatabaseToolsController())
