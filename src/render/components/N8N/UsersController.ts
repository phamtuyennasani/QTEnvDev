import { I18nT } from '@lang/index'
import { ElMessage } from 'element-plus'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'
import { reactiveBind } from '@/util/Index'
import { dialog } from '@/util/NodeFn'

export type N8nUser = {
  id: string
  email: string
  firstName?: string
  lastName?: string
  roleSlug: string
  disabled: boolean
  isPending: boolean
}

type MutationArgs = {
  userSetDisabled: [id: string, disabled: boolean]
  userSetName: [id: string, firstName: string, lastName: string]
  userSetRole: [id: string, role: string]
  userResetPassword: [id: string, password: string]
  userDelete: [id: string]
  userCreate: [email: string, firstName: string, lastName: string, role: string, password: string]
  userChangeOwnerPassword: [password: string]
}

const unknownWrite = 'n8n did not report the result. Verify the change in n8n before retrying in another session.'
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)

async function request(
  action: string,
  args: unknown[],
  write = false
): Promise<unknown> {
  const result = await forkTerminalRequest(
    'app-fork:n8n',
    [action, ...args],
    write ? unknownWrite : 'The n8n request timed out.',
    90_000,
    undefined,
    true
  )
  if (result.code !== 0) throw new Error(result.msg || 'The n8n request failed.')
  return result.data
}

class N8nUsersController {
  dataDir = ''
  users: N8nUser[] = []
  pending = ''
  unknown = false
  inviteUrl = ''
  private usersAreCurrent = false

  get writable() {
    return !this.pending && !this.unknown
  }

  get canManageUsers() {
    return this.writable && this.usersAreCurrent
  }

  private async refresh() {
    this.usersAreCurrent = false
    const location = await request('getDataDir', []) as { path?: string } | undefined
    const path = location?.path
    if (!path) throw new Error('n8n did not report its data directory.')
    if (path !== this.dataDir) {
      this.users = []
      this.inviteUrl = ''
    }
    this.dataDir = path
    const users = await request('userList', [])
    if (!Array.isArray(users)) throw new Error('n8n did not report its user list.')
    this.users = users
    this.usersAreCurrent = true
  }

  private async refreshAfterWrite() {
    try {
      await this.refresh()
    } catch (error) {
      ElMessage.warning(`Change saved. Could not refresh the n8n users. ${errorText(error)}`)
    }
  }

  async load() {
    if (this.pending) return
    await this.run('load', () => this.refresh())
  }

  async scan() {
    if (!this.writable) return []
    return await this.run('scan', async () => {
      const result = await request('scanDataDir', [])
      if (!Array.isArray(result)) throw new Error('n8n did not report any scan results.')
      const paths = result.filter((path): path is string => typeof path === 'string' && !!path)
      if (!paths.length) ElMessage.warning(I18nT('n8n.usersDataDirScanNone'))
      if (paths.length === 1) await this.saveDataDir(paths[0])
      return paths.length > 1 ? paths : []
    }) ?? []
  }

  async choose() {
    if (!this.writable) return
    await this.run('directory', async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory', 'showHiddenFiles'],
        defaultPath: this.dataDir || undefined
      })
      if (!result.canceled && result.filePaths[0]) await this.saveDataDir(result.filePaths[0])
    })
  }

  async setDataDir(path: string) {
    if (!this.writable || !path) return
    await this.run('directory', () => this.saveDataDir(path))
  }

  private async saveDataDir(path: string) {
    if (path === this.dataDir) return
    await request('setDataDir', [path], true)
    this.dataDir = path
    this.users = []
    this.inviteUrl = ''
    ElMessage.success(I18nT('n8n.usersDataDirChanged'))
    await this.refreshAfterWrite()
  }

  async mutate<Action extends keyof MutationArgs>(
    action: Action,
    args: MutationArgs[Action],
    success: string
  ) {
    if (!this.canManageUsers) return false
    if (action !== 'userCreate' && action !== 'userChangeOwnerPassword' &&
        !this.users.some((user) => user.id === args[0])) {
      ElMessage.error('This account is no longer in the current list.')
      return false
    }
    return await this.run(action, async () => {
      const result = await request(action, args, true) as {
        inviteAcceptUrl?: string
        user?: { inviteAcceptUrl?: string }
        warning?: string
      } | undefined
      if (action === 'userCreate') {
        this.inviteUrl = result?.inviteAcceptUrl ?? result?.user?.inviteAcceptUrl ?? ''
      }
      ElMessage.success(success)
      if (result?.warning) ElMessage.warning(result.warning)
      if (action !== 'userResetPassword' && action !== 'userChangeOwnerPassword') {
        await this.refreshAfterWrite()
      }
      return true
    }) ?? false
  }

  async copyInvite() {
    if (!this.inviteUrl) return
    await this.run('copy', async () => {
      await navigator.clipboard.writeText(this.inviteUrl)
      ElMessage.success(I18nT('base.copySuccess'))
    })
  }

  private async run<T>(action: string, operation: () => Promise<T>): Promise<T | undefined> {
    if (this.pending) return
    this.pending = action
    try {
      return await operation()
    } catch (error) {
      const message = errorText(error)
      if (message === unknownWrite) this.unknown = true
      ElMessage.error(message)
      return undefined
    } finally {
      this.pending = ''
    }
  }
}

export const n8nUsersController = reactiveBind(new N8nUsersController())
