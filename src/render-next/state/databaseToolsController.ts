import { reactiveBind } from '@/util/Index'
import { shell } from '@/util/NodeFn'
import { MySQLManage, type MySQLDatabaseItem } from '@/components/Mysql/Manage/manage'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'
import { currentServiceVersion } from '../adapters/serviceAdapter'
import { showNotice } from './app'

export type DatabaseConnection = { name: string; version?: string; bin?: string; host: string; port?: number; user: string; password: string; dataDirectory?: string }
class DatabaseToolsController {
  connection?: DatabaseConnection
  databases: MySQLDatabaseItem[] = []
  loading = false
  saving = false
  error = ''
  private flight?: { name: string; request: Promise<boolean> }
  private version(name: string) { return currentServiceVersion(name) }
  async load(name: string): Promise<boolean> {
    if (this.flight?.name === name) return this.flight.request
    this.loading = true
    this.error = ''
    this.connection = undefined
    this.databases = []
    const request = Promise.resolve().then(async () => {
      const item: any = this.version(name)
      const isMysql = name === 'MySQL' || name === 'MariaDB'
      const flag = name === 'MySQL' ? 'mysql' : 'mariadb'
      if (isMysql) await MySQLManage.ready(flag)
      if (this.flight?.request !== request) return false
      const connection: DatabaseConnection = {
        name, version: item?.version, bin: item?.bin, host: isMysql && item ? 'localhost' : '—',
        port: Number.isInteger(item?.port) && item.port > 0 ? item.port : undefined,
        user: isMysql && item ? 'root' : '—',
        password: isMysql && item ? (MySQLManage.userPassword[item.bin]?.root ?? '—') : '—',
        dataDirectory: item?.dataDir || item?.dataPath
      }
      this.connection = connection
      if (isMysql && item?.run) {
        const result = await forkTerminalRequest(
          'app-fork:' + flag,
          ['getDatabasesWithUsers', JSON.parse(JSON.stringify(item))],
          'The database query timed out.',
          60_000,
          undefined,
          true
        )
        if (this.flight?.request !== request) return false
        if (result.code !== 0 || !Array.isArray(result.data?.list)) {
          throw new Error(result.msg || 'The database did not return its databases and users.')
        }
        this.databases = result.data.list
        const details = result.data.connection
        if (Number.isInteger(details?.port) && details.port > 0 && details.port <= 65535) {
          this.connection.port = details.port
        }
        if (typeof details?.dataDirectory === 'string' && details.dataDirectory) {
          this.connection.dataDirectory = details.dataDirectory
        }
      }
      return true
    }).catch((error) => {
      if (this.flight?.request === request) {
        this.error = error instanceof Error ? error.message : String(error)
        showNotice(this.error)
      }
      return false
    }).finally(() => {
      if (this.flight?.request === request) {
        this.loading = false
        this.flight = undefined
      }
    })
    this.flight = { name, request }
    return request
  }
  async changePassword(password: string): Promise<boolean> {
    const connection = this.connection; if (this.saving || this.loading || !connection || !connection.bin || !password || (connection.name !== 'MySQL' && connection.name !== 'MariaDB')) return false
    this.saving = true; this.error = ''
    try { const item = this.version(connection.name); if (item?.bin !== connection.bin) throw new Error('The selected database version changed. Refresh its details.'); const ok = await MySQLManage.passwordChange(item, connection.user, password); if (!ok) throw new Error('The database password was not changed.'); connection.password = password; showNotice('Database credentials updated.'); return true }
    catch (error) { this.error = error instanceof Error ? error.message : String(error); showNotice(this.error); return false }
    finally { this.saving = false }
  }
  async revealDataDirectory(): Promise<boolean> {
    const path = this.connection?.dataDirectory; if (!path) { this.error = 'This module did not report a data directory.'; showNotice(this.error); return false }
    try { await shell.showItemInFolder(path); return true } catch (error) { this.error = error instanceof Error ? error.message : String(error); showNotice(this.error); return false }
  }
}
export const databaseToolsController = reactiveBind(new DatabaseToolsController())
