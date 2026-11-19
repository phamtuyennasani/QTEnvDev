import { reactive } from 'vue'
import IPC from '@/util/IPC'
import { Machine } from '@/components/Podman/class/Machine'
import { Compose } from '@/components/Podman/class/Compose'
import XTerm from '@/util/XTerm'
import { reactiveBind } from '@/util/Index'
import { StorageGetAsync, StorageSetAsync } from '@/util/Storage'
import { XTermExec, XTermExecCache } from '@/util/XTermExec'
import { AsyncComponentShow } from '@/util/AsyncComponent'
import { I18nT } from '@lang/index'
import { ElMessageBox } from 'element-plus'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'

class Podman {
  machine: Machine[] = []
  compose: Compose[] = [] // 新增 compose 列表
  version: string = ''
  inited: boolean = false
  loading: boolean = false
  discoveryError = ''
  tab: string = ''
  imageVersion: Partial<Record<string, string[]>> = {}

  installEnd: boolean = false
  installing: boolean = false
  xterm: XTerm | undefined

  dockerComposeExists: boolean = false
  dockerComposeInstalling: boolean = false

  ComposeFetching = false

  onMachineRemove(item: Machine) {
    this.machine = this.machine.filter((f) => f.name !== item.name)
  }

  initImageVersion() {
    if (Object.keys(this.imageVersion).length > 0) {
      return
    }
    const storeKey = 'qtenvdev-podman-image-version'
    const doFetch = () => {
      IPC.send('app-fork:podman', 'fetchImagesVersion').then((key: string, res: any) => {
        IPC.off(key)
        if (res?.code === 0) {
          const obj: any = res?.data ?? {}
          this.imageVersion = reactive(obj)
          StorageSetAsync(storeKey, obj, 3 * 24 * 60 * 60).catch()
        }
      })
    }
    StorageGetAsync<Partial<Record<string, string[]>>>(storeKey)
      .then((res) => {
        if (res && typeof res === 'object' && !Array.isArray(res)) this.imageVersion = reactive(res)
        else doFetch()
      })
      .catch(doFetch)
  }

  init() {
    if (this.inited || this.loading) {
      return
    }
    this.loading = true
    this.discoveryError = ''
    this.initImageVersion()
    this.checkIsComposeExists()
    PodmanManager.loadComposeList().catch()
    void forkTerminalRequest('app-fork:podman', ['podmanInit'], 'Podman discovery did not respond.', 60_000).then((res) => {
      if (res?.code === 0) {
        this.inited = true
        this.version = res?.data?.version ?? ''
        const arr = res?.data?.machine ?? []
        this.machine.splice(0)
        for (const item of arr) {
          const machine = reactiveBind(new Machine(item))
          machine._onRemove = this.onMachineRemove
          this.machine.push(machine)
        }
        const machine = this.machine.find((m) => m.run) ?? this.machine?.[0]
        if (machine) {
          this.tab = machine.name
          if (machine.run) {
            machine.fetchInfoAndContainer()
            this.refreshComposeState()
          }
        }
      } else {
        throw new Error(res?.msg || 'Podman discovery failed.')
      }
    }).catch((error) => {
      this.discoveryError = error instanceof Error ? error.message : String(error)
    }).finally(() => {
      this.loading = false
    })
  }

  reinit() {
    if (this.loading) return
    this.inited = false
    this.init()
  }

  tabChange(item: Machine) {
    this.tab = item.name
    item.fetchInfoAndContainer()
  }

  async loadComposeList() {
    this.ComposeFetching = true
    const all = []
    const storeKey = 'qtenvdev-podman-compose-list'
    try {
      const arr = await StorageGetAsync(storeKey)
      this.compose = []
      if (Array.isArray(arr)) {
        for (const item of arr) {
          const compose = reactiveBind(new Compose(item))
          all.push(compose.checkRunningStatus())
          this.compose.push(compose)
        }
      }
    } catch {
      this.compose = []
    }
    if (all.length === 0) {
      this.ComposeFetching = false
    } else {
      await Promise.all(all)
      this.ComposeFetching = false
    }
  }

  refreshComposeState() {
    if (this.ComposeFetching || !this.compose.length) {
      return
    }
    this.ComposeFetching = true
    const all = this.compose.map((item) => item.checkRunningStatus())
    Promise.all(all).finally(() => {
      this.ComposeFetching = false
    })
  }

  async saveComposeList() {
    const storeKey = 'qtenvdev-podman-compose-list'
    await StorageSetAsync(storeKey, JSON.parse(JSON.stringify(this.compose)))
  }

  addCompose(item: any) {
    const compose = reactiveBind(new Compose(item))
    this.compose.push(compose)
    this.saveComposeList().catch()
    compose.checkRunningStatus()
  }

  removeCompose(item: Compose) {
    ElMessageBox.confirm(I18nT('base.delAlertContent'), I18nT('host.warning'), {
      confirmButtonText: I18nT('base.confirm'),
      cancelButtonText: I18nT('base.cancel'),
      type: 'warning'
    }).then(() => {
      this.compose = this.compose.filter((f) => f.id !== item.id)
      this.saveComposeList().catch()
    })
  }

  updateCompose(item: Compose) {
    const idx = this.compose.findIndex((f) => f.id === item.id)
    if (idx !== -1) {
      this.compose[idx] = item
      this.saveComposeList().catch()
    }
  }

  currentMachine() {
    return this.machine.find((m) => m.name === this.tab)
  }

  currentSocket() {
    return this.currentMachine()?.info?.ConnectionInfo?.PodmanSocket?.Path
  }

  checkIsComposeExists() {
    IPC.send('app-fork:podman', 'checkIsComposeExists').then((key: string, res: any) => {
      IPC.off(key)
      if (res?.code === 0) {
        this.dockerComposeExists = true
      } else {
        this.dockerComposeExists = false
      }
    })
  }

  installDockerCompose() {
    const id = 'App-Podman-DockerCompose-Install'
    if (this.dockerComposeInstalling) {
      const xtermExec = XTermExecCache?.[id]
      if (xtermExec) {
        import('@/components/XTermExecDialog/index.vue').then((res) => {
          AsyncComponentShow(res.default, {
            title: xtermExec.title,
            item: xtermExec
          }).then(() => {
            this.checkIsComposeExists()
          })
        })
      }
      return
    }

    this.dockerComposeInstalling = true
    let xtermExec = XTermExecCache?.[id]
    if (!xtermExec) {
      xtermExec = reactiveBind(new XTermExec())
      xtermExec.id = id
      const arr: string[] = ['brew install docker-compose']
      xtermExec.command = [arr.join(' ')]
      xtermExec.wait().then(() => {
        delete XTermExecCache?.[id]
        this.checkIsComposeExists()
      })
      XTermExecCache[id] = xtermExec
    }
    import('@/components/XTermExecDialog/index.vue').then((res) => {
      AsyncComponentShow(res.default, {
        title: I18nT('podman.DockerComposeInstallButton'),
        item: xtermExec
      }).then(() => {
        this.checkIsComposeExists()
      })
    })
  }
}

const PodmanManager = reactiveBind(new Podman())

export { PodmanManager }
