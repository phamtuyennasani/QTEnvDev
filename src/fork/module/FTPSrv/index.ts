import { join } from 'path'
import { existsSync } from 'fs'
import { Base } from '../Base'
import type { FtpItem, SoftInstalled } from '@shared/app'
import { ForkPromise } from '@shared/ForkPromise'
import FtpServer from 'ftp-srv'
import { readFile, writeFile, mkdirp, copyFile, remove } from '../../Fn'
import { isWindows } from '@shared/utils'
import { getPrimaryLocalIPAddress } from '@shared/network'
import { stat, rename, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

class Manager extends Base {
  server?: FtpServer
  private readonly users = new Map<string, string>()
  private accountWrites = Promise.resolve()

  baseDir: string = ''

  constructor() {
    super()
    this.type = 'ftp-srv'
    this.baseDir = join(global.Server.BaseDir!, 'ftp-srv')
  }

  init() {}

  workspaceStatus() {
    return new ForkPromise((resolve) => resolve({ running: Boolean(this.server), port: 21 }))
  }

  private async readAccounts(): Promise<FtpItem[]> {
    const path = join(this.baseDir, 'ftp-srv.json')
    try {
      const accounts: unknown = JSON.parse(await readFile(path, 'utf8'))
      if (!Array.isArray(accounts)) throw new Error('The saved FTP accounts are not a list.')
      return accounts
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return []
      throw error
    }
  }

  private async saveAccounts(accounts: FtpItem[]) {
    const path = join(this.baseDir, 'ftp-srv.json')
    const temporary = path + '.' + randomUUID() + '.tmp'
    try {
      await writeFile(temporary, JSON.stringify(accounts), { flag: 'wx', mode: 0o600 })
      await rename(temporary, path)
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined)
    }
  }

  private changeAccounts(item: FtpItem, removeAccount: boolean, reportCommit: boolean) {
    const next = this.accountWrites.then(async () => {
      await this.fixJson()
      const all = await this.readAccounts()
      if (!removeAccount) {
        if (!item.user?.trim() || !item.pass || !(await stat(item.dir)).isDirectory()) {
          throw new Error('Choose a username, password and existing folder.')
        }
      }
      const rest = all.filter((account) => account.user !== item.user)
      await this.saveAccounts(removeAccount ? rest : [item, ...rest])
      const active = [...this.users].filter(([, name]) => name === item.user)
      const results = await Promise.allSettled(
        active.map(async ([id]) => this.server?.disconnectClient(id))
      )
      if (results.some((result) => result.status === 'rejected') && reportCommit) {
        return {
          warning: 'The account was saved, but an existing FTP connection could not be closed.'
        }
      }
      return true
    })
    this.accountWrites = next.then(
      () => undefined,
      () => undefined
    )
    return new ForkPromise<boolean | { warning: string }>((resolve, reject) =>
      next.then(resolve, reject)
    )
  }

  async fixJson() {
    await mkdirp(this.baseDir)
    if (isWindows()) {
      const json = join(global.Server.FTPDir!, 'pureftpd.json')
      if (existsSync(json)) {
        await copyFile(json, join(this.baseDir, 'ftp-srv.json'))
        await remove(json)
      }
    }
  }

  _stopServer(): ForkPromise<any> {
    return new ForkPromise(async (resolve) => {
      // FTP server 由专用 fork 持有；close 完成才报告停止，拒绝时 ForkPromise 保留失败。
      await this.server?.close()
      this.server = undefined
      this.users.clear()
      // 这里只回传宿主 fork PID 用于注销运行登记，不按该 PID 结束 Electron worker。
      resolve({ 'APP-Service-Stop-PID': [`${process.pid}`] })
    })
  }

  _startServer() {
    const resolverFunction = (clientIP: string) => {
      if (clientIP === '127.0.0.1' || clientIP === '::1') {
        return '127.0.0.1' // 本地连接直接返回回环地址
      }
      return getPrimaryLocalIPAddress()
    }

    return new ForkPromise(async (resolve, reject) => {
      const port = 21
      const server = new FtpServer({
        url: `ftp://0.0.0.0:${port}/`,
        anonymous: true,
        pasv_url: resolverFunction as any,
        pasv_min: 49152,
        pasv_max: 65535
      })

      server.on('login', async ({ connection, username, password }, resolve, reject) => {
        connection.on('client-error', (error: any) => {
          console.error('FTP Client Error:', error)
        })
        connection.on('STOR', (error: any) => {
          if (error) console.error('Upload failed:', error)
        })

        try {
          const all = await this.readAccounts()
          const account = all.find(
            (item) => item.user === username && item.pass === password && !item.disabled
          )
          if (account) {
            this.users.set(connection.id, username)
            return resolve({ root: account.dir.split('\\').join('/') })
          }
        } catch {}
        return reject(new Error('Invalid username or password'))
      })
      server.on('disconnect', ({ id }) => {
        this.users.delete(id)
      })

      server
        .listen()
        .then(() => {
          this.server = server
          console.log('Ftp server is starting...')
          // 登记宿主 PID 仅用于状态与退出编排，stopService 自己关闭 FTP server。
          resolve({ 'APP-Service-Start-PID': `${process.pid}` })
        })
        .catch(reject)
    })
  }

  getPort() {
    return new ForkPromise(async (resolve) => {
      const port: any = 21
      resolve(port)
    })
  }

  getAllFtp() {
    return new ForkPromise(async (resolve) => {
      await this.accountWrites
      await this.fixJson()
      resolve(await this.readAccounts())
    })
  }

  delFtp(item: FtpItem, reportCommit = false) {
    return this.changeAccounts(item, true, reportCommit)
  }

  addFtp(item: FtpItem, reportCommit = false) {
    return this.changeAccounts(item, false, reportCommit)
  }

  getConfigFiles(_version?: SoftInstalled): Array<{ name: string; path: string }> {
    return [
      {
        name: 'ftp-srv.json',
        path: join(this.baseDir, 'ftp-srv.json')
      }
    ]
  }

  getLogFiles(_version?: SoftInstalled): Array<{ name: string; path: string }> {
    return []
  }
}

export default new Manager()
