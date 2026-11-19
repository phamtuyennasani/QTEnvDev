import type { FtpItem } from '@shared/app'

export type FtpMode = 'ftp-srv' | 'pure-ftpd'
type Lifecycle = 'start' | 'stop' | 'restart'
type Account = Pick<FtpItem, 'user' | 'pass' | 'dir' | 'disabled' | 'mark'>
type Status = { running: boolean; installed: boolean; port?: number }
export class FtpMutationUnknown extends Error {}

type Dependencies = {
  status: () => Promise<Status>
  accounts: () => Promise<Account[]>
  change: (action: Lifecycle) => Promise<void>
  write: (action: 'add' | 'del', account: Account) => Promise<string | undefined>
  folder: (path?: string) => Promise<string | undefined>
  open: (path: string) => Promise<void>
  copy: (text: string) => Promise<void>
  addresses: () => Promise<{ ip: string; name: string; isVirtual: boolean }[]>
}

export class FtpAccountsController {
  status?: Status
  accounts: Account[] = []
  addresses: { ip: string; name: string; isVirtual: boolean }[] = []
  accountsVerified = false
  busy = false
  error = ''
  warning = ''
  message = ''

  constructor(private readonly deps: Dependencies) {}

  refresh() {
    return this.run(async () => {
      const results = await Promise.allSettled([
        this.readStatus(),
        this.readAccounts(),
        this.deps.addresses().then((addresses) => {
          this.addresses = addresses
        })
      ])
      const failures = results.flatMap((item) =>
        item.status === 'rejected' ? [String(item.reason)] : []
      )
      if (failures.length) this.error = failures.join('\n')
      return !failures.length
    })
  }

  change(action: Lifecycle) {
    if (!this.status?.installed) return Promise.resolve(false)
    return this.run(async () => {
      this.status = undefined
      try {
        await this.deps.change(action)
      } catch (error) {
        await this.readStatus().catch(() => undefined)
        throw error
      }
      this.message = action === 'stop' ? 'FTP service stopped.' : 'FTP service started.'
      await this.readStatus().catch((error) => {
        this.warning = 'Service status: ' + String(error)
      })
      return true
    })
  }

  save(input: Account, editing: boolean) {
    if (!this.accountsVerified || !this.status?.installed) return Promise.resolve(false)
    const item = { ...input, user: input.user.trim() }
    return this.run(async () => {
      if (!item.user || !item.pass || !item.dir)
        throw new Error('Enter a username and password and choose a folder.')
      if (this.accounts.some((account) => account.user === item.user) !== editing) {
        throw new Error('This username changed or already exists. Refresh the account list.')
      }
      return this.commit('add', item, editing ? 'FTP account updated.' : 'FTP account added.')
    })
  }

  remove(item: Account) {
    if (!this.accountsVerified || !this.status?.installed) return Promise.resolve(false)
    const snapshot = { ...item }
    return this.run(() => this.commit('del', snapshot, 'FTP account removed.'))
  }

  chooseFolder(path?: string) {
    return this.deps.folder(path).catch((error) => {
      this.error = String(error)
      return undefined
    })
  }

  async openFolder(path: string) {
    await this.deps.open(path).catch((error) => {
      this.error = String(error)
    })
  }

  async copyPassword(item: Account) {
    try {
      await this.deps.copy(item.pass)
      this.message = 'Password copied.'
    } catch (error) {
      this.error = String(error)
    }
  }

  private async readStatus() {
    this.status = undefined
    this.status = await this.deps.status()
  }

  private async readAccounts() {
    this.accountsVerified = false
    this.accounts = await this.deps.accounts()
    this.accountsVerified = true
  }

  private async commit(action: 'add' | 'del', item: Account, message: string) {
    try {
      this.warning = (await this.deps.write(action, item)) ?? ''
    } catch (error) {
      if (error instanceof FtpMutationUnknown) this.accountsVerified = false
      throw error
    }
    this.message = message
    await this.readAccounts().catch((error) => {
      this.warning = [this.warning, 'Account list: ' + String(error)].filter(Boolean).join('\n')
    })
    return true
  }

  private async run(task: () => Promise<boolean>) {
    if (this.busy) return false
    this.busy = true
    this.error = this.message = this.warning = ''
    try {
      return await task()
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      return false
    } finally {
      this.busy = false
    }
  }
}
