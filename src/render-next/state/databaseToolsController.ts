import { reactiveBind } from '@/util/Index'
import { shell } from '@/util/NodeFn'
import { MySQLManage, type MySQLDatabaseItem } from '@/components/Mysql/Manage/manage'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'
import { databaseVersion } from '../adapters/databaseAdapter'
import { showNotice } from './app'

export type DatabaseConnection = {
  name: string
  version?: string
  bin?: string
  host: string
  port?: number
  user: string
  password: string
  dataDirectory?: string
}
const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

class DatabaseToolsController {
  connection?: DatabaseConnection
  databases: MySQLDatabaseItem[] = []
  loading = false
  saving = false
  error = ''
  private flight?: { key: string; request: Promise<boolean> }

  load(name: string): Promise<boolean> {
    const item = databaseVersion(name)
    const flag = name === 'MySQL' ? 'mysql' : name === 'MariaDB' ? 'mariadb' : undefined
    const target = item?.bin && item.version ? { bin: item.bin, version: item.version } : undefined
    const running = item?.run === true
    const key = JSON.stringify([name, target, running])
    if (this.flight?.key === key) return this.flight.request
    this.loading = true
    this.error = ''
    this.databases = []
    this.connection = {
      name,
      ...target,
      host: '—',
      user: flag && target ? 'root' : '—',
      password: '—'
    }
    const snapshot = running ? JSON.parse(JSON.stringify(item)) : undefined
    const current = () => this.flight?.request === request
    const request: Promise<boolean> = Promise.resolve()
      .then(async () => {
        if (!flag || !target) return true
        const channel = `app-fork:${flag}`
        const endpoint = async () => {
          const result = await forkTerminalRequest(
            channel,
            ['databaseConnectionEndpoint', target],
            'The configured endpoint query timed out.',
            60_000,
            undefined,
            true
          )
          if (result.code !== 0)
            throw new Error(result.msg || 'The configured endpoint is unavailable.')
          if (!current() || !this.connection) return
          const { port, dataDirectory } = result.data ?? {}
          if (Number.isInteger(port) && port > 0 && port <= 65535) {
            this.connection.host = '127.0.0.1'
            this.connection.port = port
          }
          if (typeof dataDirectory === 'string' && dataDirectory) {
            this.connection.dataDirectory = dataDirectory
          }
        }
        const accounts = async () => {
          await MySQLManage.ready(flag)
          if (!current() || !this.connection) return
          const saved = MySQLManage.userPassword[target.bin]?.root
          this.connection.password = saved ?? '—'
          if (!snapshot) return
          const result = await forkTerminalRequest(
            channel,
            [
              'getDatabasesWithUsers',
              { ...snapshot, rootPassword: saved ?? snapshot.rootPassword }
            ],
            'The database query timed out.',
            60_000,
            undefined,
            true
          )
          if (!current()) return
          if (result.code !== 0 || !Array.isArray(result.data?.list)) {
            throw new Error(result.msg || 'The database did not return its databases and users.')
          }
          this.databases = result.data.list
        }
        const results = await Promise.allSettled([endpoint(), accounts()])
        if (!current()) return false
        const warnings = results.flatMap((result) =>
          result.status === 'rejected' ? [message(result.reason)] : []
        )
        if (warnings.length) {
          this.error = warnings.join(' ')
          showNotice(this.error)
          return false
        }
        return true
      })
      .finally(() => {
        if (current()) {
          this.loading = false
          this.flight = undefined
        }
      })
    this.flight = { key, request }
    return request
  }

  async changePassword(password: string): Promise<boolean> {
    const { connection } = this
    if (
      this.saving ||
      this.loading ||
      !connection?.bin ||
      !password ||
      (connection.name !== 'MySQL' && connection.name !== 'MariaDB')
    )
      return false
    this.saving = true
    this.error = ''
    try {
      const item = databaseVersion(connection.name)
      if (!item || item.bin !== connection.bin || item.version !== connection.version) {
        throw new Error('The selected database version changed. Refresh its details.')
      }
      if (!(await MySQLManage.passwordChange(item, connection.user, password))) {
        throw new Error('The database password was not changed.')
      }
      if (this.connection === connection) {
        connection.password = password
      }
      showNotice('Database credentials updated.')
      return true
    } catch (error) {
      const failure = message(error)
      if (this.connection === connection) this.error = failure
      showNotice(failure)
      return false
    } finally {
      this.saving = false
    }
  }
  async revealDataDirectory(): Promise<boolean> {
    const path = this.connection?.dataDirectory
    if (!path) {
      this.error = 'This module did not report a data directory.'
      showNotice(this.error)
      return false
    }
    try {
      await shell.showItemInFolder(path)
      return true
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      showNotice(this.error)
      return false
    }
  }
}
export const databaseToolsController = reactiveBind(new DatabaseToolsController())
