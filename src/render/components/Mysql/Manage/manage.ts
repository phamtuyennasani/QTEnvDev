import { reactive } from 'vue'
import localForage from 'localforage'
import { MessageError, MessageSuccess, MessageWarning } from '@/util/Element'
import { I18nT } from '@lang/index'
import type { ModuleInstalledItem } from '@/core/Module/ModuleInstalledItem'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'
import { BrewStore } from '@/store/brew'
import { waitTime } from '@/util/Index'
import { dialog, shell } from '@/util/NodeFn'

export type MySQLDatabaseItem = {
  name: string
  users: string[]
}

export type MySQLDatabaseSavedItem = {
  database: string
  user: string
  mark: string
}

export type MySQLUserItem = Record<string, string>

type MySQLManageType = {
  inited: boolean
  userPassword: Record<string, MySQLUserItem>
  backupDir: Record<string, string>
  updating: Record<string, boolean>
  backuping: Record<string, boolean>
  databaseRaw: Record<string, MySQLDatabaseItem[]>
  databaseSaved: Record<string, MySQLDatabaseSavedItem[]>
  init: (flag: 'mysql' | 'mariadb') => void
  ready: (flag: 'mysql' | 'mariadb') => Promise<void>
  save: () => void
  passwordChange: (item: ModuleInstalledItem, user: string, password: string) => Promise<boolean>
  fetchDatabase: (item: ModuleInstalledItem) => Promise<MySQLDatabaseItem[]>
  addDatabase: (item: ModuleInstalledItem, data: any) => Promise<boolean>
  backupDatabase: (item: ModuleInstalledItem, databases: string[]) => Promise<boolean>
}

const MySQLManageKey = 'qtenvdev-mysql-manage-key'
let settingsLoad: Promise<void> | undefined
const fetching = new Map<string, Promise<MySQLDatabaseItem[]>>()
const creating = new Set<string>()

const request = async (
  item: ModuleInstalledItem,
  action: string,
  args: unknown[] = [],
  timeout = 60_000
) => {
  const reply = await forkTerminalRequest(
    'app-fork:' + item.typeFlag,
    [action, JSON.parse(JSON.stringify(item)), ...args],
    'The database operation did not report a result. Check its state before retrying.',
    timeout,
    undefined,
    true
  )
  if (reply.code !== 0) throw new Error(reply.msg || I18nT('base.fail'))
  return reply.data
}

const ensureStarted = async (item: ModuleInstalledItem) => {
  if (item.run) return
  const started = await item.start()
  if (started !== true) throw new Error(typeof started === 'string' ? started : I18nT('base.fail'))
  await waitTime(1000)
}

const MySQLManage = reactive<MySQLManageType>({
  userPassword: {},
  backupDir: {},
  updating: {},
  backuping: {},
  databaseRaw: {},
  databaseSaved: {},
  inited: false,
  init(flag: 'mysql' | 'mariadb') {
    void this.ready(flag).catch((error) =>
      console.error('Could not load database settings:', error)
    )
  },
  async ready(flag: 'mysql' | 'mariadb') {
    if (!this.inited) {
      settingsLoad ??= localForage
        .getItem<Partial<MySQLManageType>>(MySQLManageKey)
        .then((saved) => {
          if (saved) {
            this.userPassword = saved.userPassword ?? {}
            this.backupDir = saved.backupDir ?? {}
            this.databaseSaved = saved.databaseSaved ?? {}
          }
          this.inited = true
        })
        .finally(() => {
          settingsLoad = undefined
        })
      await settingsLoad
    }
    for (const item of BrewStore().module(flag).installed) {
      item.rootPassword = this.userPassword[item.bin]?.root ?? 'root'
    }
  },
  save() {
    const data = JSON.parse(JSON.stringify(this))
    delete data.databaseRaw
    delete data.updating
    delete data.backuping
    delete data.inited
    localForage.setItem(MySQLManageKey, data).catch()
  },
  async backupDatabase(item: ModuleInstalledItem, databases: string[]) {
    if (this.backuping[item.bin] || !databases.length) return false
    const selected = [...databases]
    this.backuping[item.bin] = true
    try {
      let saveDir = this.backupDir?.[item.bin]
      if (!saveDir) {
        const { canceled, filePaths } = await dialog.showOpenDialog({
          properties: ['openDirectory', 'createDirectory', 'showHiddenFiles']
        })
        if (canceled || !filePaths[0]) return false
        saveDir = filePaths[0]
      }
      await ensureStarted(item)
      const errors = await request(item, 'backupDatabase', [selected, saveDir], 30 * 60_000)
      if (!Array.isArray(errors)) throw new Error(I18nT('base.fail'))
      if (errors.length) MessageWarning(errors.join('\n'))
      else MessageSuccess(I18nT('base.success'))
      try {
        const folderError = await shell.openPath(saveDir)
        if (folderError) MessageWarning(folderError)
      } catch (error) {
        MessageWarning(error instanceof Error ? error.message : String(error))
      }
      return errors.length === 0
    } catch (error) {
      MessageError(error instanceof Error ? error.message : String(error))
      return false
    } finally {
      delete this.backuping[item.bin]
    }
  },
  async passwordChange(item: ModuleInstalledItem, user: string, password: string) {
    if (this.updating[item.bin]) return false
    if (!password || /['"，。？！；：“”‘’（）【】《》￥&\u4e00-\u9fa5]+/.test(password)) {
      MessageError(I18nT(password ? 'mysql.passwordFormatError' : 'mysql.passwordNoEmpty'))
      return false
    }
    this.updating[item.bin] = true
    try {
      const stopped = await item.stop()
      if (stopped !== true)
        throw new Error(typeof stopped === 'string' ? stopped : I18nT('base.fail'))
      await waitTime(1500)
      await request(item, 'passwordChange', [user, password])
      if (user === 'root') item.rootPassword = password
      this.userPassword[item.bin] ??= {}
      this.userPassword[item.bin][user] = password
      this.save()
      MessageSuccess(I18nT('base.success'))
      try {
        await ensureStarted(item)
      } catch (error) {
        MessageWarning(error instanceof Error ? error.message : String(error))
      }
      return true
    } catch (error) {
      MessageError(error instanceof Error ? error.message : String(error))
      return false
    } finally {
      delete this.updating[item.bin]
    }
  },
  fetchDatabase(item: ModuleInstalledItem): Promise<MySQLDatabaseItem[]> {
    const pending = fetching.get(item.bin)
    if (pending) return pending
    const flight = request(item, 'getDatabasesWithUsers')
      .then((data) => {
        if (!Array.isArray(data?.list) || !Array.isArray(data?.allUsers))
          throw new Error(I18nT('base.fail'))
        this.databaseRaw[item.bin] = data.list
        const allUser: any[] = data.allUsers
        const users = allUser.map((u: any) => u.User)
        const userPassword = this.userPassword?.[item.bin]
        let changed = false
        if (userPassword && users.length) {
          for (const u in userPassword) {
            if (!users.includes(u)) {
              changed = true
              delete userPassword[u]
            }
          }
        }
        const saved = this.databaseSaved?.[item.bin]
        if (saved && users.length) {
          this.databaseSaved[item.bin] = saved.filter((d) => {
            const find = this.databaseRaw[item.bin].some((r) => d.database === r.name)
            if (!find) {
              changed = true
            }
            return find
          })
        }
        if (changed) {
          this.save()
        }
        return this.databaseRaw[item.bin]
      })
      .catch((error) => {
        MessageError(error instanceof Error ? error.message : String(error))
        return this.databaseRaw[item.bin] ?? []
      })
      .finally(() => fetching.delete(item.bin))
    fetching.set(item.bin, flight)
    return flight
  },
  async addDatabase(
    item: ModuleInstalledItem,
    data: { database: string; user: string; charset: string; password: string }
  ) {
    if (creating.has(item.bin)) return false
    creating.add(item.bin)
    const snapshot = { ...data }
    try {
      await ensureStarted(item)
      await request(item, 'addDatabase', [snapshot])
      let saved = this.databaseSaved?.[item.bin]
      if (!saved) {
        this.databaseSaved[item.bin] = reactive([])
        saved = this.databaseSaved[item.bin]
      }
      saved.unshift(
        reactive({
          database: snapshot.database,
          user: snapshot.user,
          mark: ''
        })
      )

      let userPassword = this.userPassword?.[item.bin]
      if (!userPassword) {
        this.userPassword[item.bin] = reactive({})
        userPassword = this.userPassword[item.bin]
      }
      userPassword[snapshot.user] = snapshot.password

      this.save()
      MessageSuccess(I18nT('base.success'))
      await fetching.get(item.bin)
      await this.fetchDatabase(item)
      return true
    } catch (error) {
      MessageError(error instanceof Error ? error.message : String(error))
      return false
    } finally {
      creating.delete(item.bin)
    }
  }
})

MySQLManage.init = MySQLManage.init.bind(MySQLManage)
MySQLManage.save = MySQLManage.save.bind(MySQLManage)
MySQLManage.passwordChange = MySQLManage.passwordChange.bind(MySQLManage)
MySQLManage.fetchDatabase = MySQLManage.fetchDatabase.bind(MySQLManage)
MySQLManage.addDatabase = MySQLManage.addDatabase.bind(MySQLManage)
MySQLManage.backupDatabase = MySQLManage.backupDatabase.bind(MySQLManage)

export { MySQLManage }
