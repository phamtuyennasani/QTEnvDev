import { defineStore } from 'pinia'
import IPC from '@/util/IPC'
import { ElMessage, ElMessageBox } from 'element-plus'
import { I18nT } from '@lang/index'
import { AppStore } from '@/store/app'
import { MessageError } from '@/util/Element'
import { reactive } from 'vue'
import localForage from 'localforage'
import { shell } from '@/util/NodeFn'

type GitHubUser = {
  uuid: string
  avatar_url: string
  login: string
}

type GitHubLicenseItem = {
  uuid: string
  license: string
}

interface State {
  tab: string
  uuid: string
  activeCode: string
  isActive: boolean
  message: string
  fetching: boolean
  githubAuthing: boolean

  githubUser?: GitHubUser
  githubLicense?: GitHubLicenseItem[]
}

const state: State = {
  tab: 'base',
  uuid: '',
  activeCode: '',
  isActive: false,
  message: '',
  fetching: false,
  githubAuthing: false
}

export const SetupStore = defineStore('setup', {
  state: (): State => state,
  getters: {},
  actions: {
    init() {
      return new Promise<void>((resolve) => {
        this.message = localStorage.getItem('qtenvdev-licenses-post-message') ?? ''
        // License check removed — force active state immediately
        this.isActive = true
        this.activeCode = ''
        this.uuid = ''
        localForage
          .getItem('qtenvdev-user-github')
          .then((res: any) => {
            if (res?.githubUser) {
              this.githubUser = reactive(res.githubUser)
            }
            if (res?.githubLicense) {
              this.githubLicense = reactive(res.githubLicense)
            }
          })
          .finally(() => {
            this.githubUserRefresh()
            // Resolve only after all async init completes
            resolve()
          })
      })
    },
    refreshState() {
      // License check removed — no-op, always active
      this.fetching = false
      this.isActive = true
      this.activeCode = ''
      this.githubLicenseFetch()
    },
    postRequest() {
      // License check removed — no-op
      this.fetching = false
    },
    githubInfoSave() {
      localForage
        .setItem(
          'qtenvdev-user-github',
          JSON.parse(
            JSON.stringify({ githubUser: this.githubUser, githubLicense: this.githubLicense })
          )
        )
        .catch()
    },
    githubUserRefresh() {
      IPC.send('app-fork:app', 'githubUserFetch').then((key: string, res?: any) => {
        IPC.off(key)
        if (res?.code !== 0 || !res?.data?.user) return
        this.githubUser = reactive(res.data.user)
        this.githubLicense = reactive(res.data.license ?? [])
        this.githubInfoSave()
      })
    },
    githubAuthStart() {
      if (this.githubAuthing) {
        return
      }
      this.githubAuthing = true
      IPC.send('GitHub-OAuth-Start').then((key, res?: any) => {
        IPC.off(key)
        this.githubAuthing = false
        if (res?.code === 1) {
          MessageError(res?.msg ?? I18nT('base.fail'))
          return
        }
        const user = reactive(res?.data?.user ?? {})
        const license = reactive(res?.data?.license ?? [])
        this.githubUser = user
        this.githubLicense = license
        const store = AppStore()
        store.config.setup.user_uuid = user?.uuid
        store.saveConfig().then().catch()
        this.githubInfoSave()
      })
    },
    githubAuthCancel() {
      IPC.send('GitHub-OAuth-Cancel').then((key) => {
        IPC.off(key)
        this.githubAuthing = false
      })
    },
    githubAuthLogout() {
      ElMessageBox.confirm(I18nT('licenses.logoutTips'), {
        confirmButtonText: I18nT('base.confirm'),
        cancelButtonText: I18nT('base.cancel'),
        type: 'warning'
      }).then(() => {
        this.githubUser = undefined
        this.githubLicense = undefined
        const store = AppStore()
        store.config.setup.user_uuid = ''
        store.saveConfig().then().catch()
        localForage.removeItem('qtenvdev-user-github').catch()
      })
    },
    githubLicenseFetch() {
      if (this.githubAuthing || !this.githubUser?.uuid) {
        return
      }
      this.githubAuthing = true
      IPC.send('GitHub-OAuth-License-Fetch').then((key, res: any) => {
        IPC.off(key)
        this.githubAuthing = false
        if (res?.code === 0) {
          this.githubLicense = reactive(res?.data ?? [])
          this.githubInfoSave()
        } else if (res?.code === 1) {
          MessageError(res?.msg ?? I18nT('base.fail'))
        }
      })
    },
    githubAuthDelBind(uuid: string, license: string) {
      ElMessageBox.confirm(I18nT('licenses.delBindTips'), {
        confirmButtonText: I18nT('base.confirm'),
        cancelButtonText: I18nT('base.cancel'),
        type: 'warning'
      }).then(() => {
        this.githubAuthing = true
        IPC.send('GitHub-OAuth-License-Del-Bind', uuid, license).then((key: string, res: any) => {
          IPC.off(key)
          this.githubAuthing = false
          if (res?.code === 0) {
            this.githubLicense = reactive(res?.data ?? [])
            this.githubInfoSave()
            if (uuid === this.uuid) {
              const store = AppStore()
              store.config.setup.license = ''
              store.saveConfig().then().catch()
              this.isActive = false
              window.Server.UserUUID = ''
            }
          } else if (res?.code === 1) {
            MessageError(res?.msg ?? I18nT('base.fail'))
          }
        })
      })
    },
    githubAuthAddBind(uuid: string, license: string) {
      ElMessageBox.confirm(I18nT('licenses.addBindTips'), {
        confirmButtonText: I18nT('base.confirm'),
        cancelButtonText: I18nT('base.cancel'),
        type: 'warning'
      }).then(() => {
        this.githubAuthing = true
        IPC.send('GitHub-OAuth-License-Add-Bind', uuid, license).then((key: string, res: any) => {
          IPC.off(key)
          this.githubAuthing = false
          if (res?.code === 0) {
            this.githubLicense = reactive(res?.data ?? [])
            this.githubInfoSave()
            this.refreshState()
          } else if (res?.code === 1) {
            MessageError(res?.msg ?? I18nT('base.fail'))
          }
        })
      })
    }
  }
})
