import { computed, ref } from 'vue'
import { I18nT } from '@lang/index'
import { BrewStore } from '@/store/brew'
import { MessageError } from '@/util/Element'
import { shell } from '@/util/NodeFn'
import IPC from '@/util/IPC'
import { ElMessage } from 'element-plus'
import { isWebPanelInstallNotice } from '@shared/WebPanelInstallNotice'

export class DbGatePanel {
  readonly opening = ref(false)
  readonly nodeAvailable = computed(() => !!BrewStore().currentVersion('node')?.bin)
  private installNotice: { close: () => void } | undefined

  open = async () => {
    if (this.opening.value) return false
    this.opening.value = true
    try {
      const brew = BrewStore()
      if (!(await brew.module('node').fetchInstalled(true, { fresh: true }))) {
        throw new Error(I18nT('base.serviceRuntimeFetchFailed', { service: 'DbGate', runtime: 'NodeJS' }))
      }
      const node = brew.currentVersion('node')
      if (!node?.bin) {
        throw new Error(
          I18nT('base.serviceRequiresRuntime', { service: 'DbGate', runtime: 'NodeJS', module: 'NodeJS' })
        )
      }
      if (!brew.module('mongodb').installed.some((item) => item.run)) {
        throw new Error(
          I18nT('base.serviceRequiresRunningService', { service: 'DbGate', dependency: 'MongoDB' })
        )
      }
      const selectedNode = JSON.parse(JSON.stringify(node))
      IPC.sendSensitive('app-fork:mongodb', 'openDbGate', selectedNode).then(
        (key: string, res: any) => this.handleResponse(key, res)
      )
      return true
    } catch (error) {
      this.complete()
      MessageError(error instanceof Error ? error.message : 'DbGate failed to start')
      return false
    }
  }

  private handleResponse(key: string, res: any) {
    if (res?.code === 200) {
      if (isWebPanelInstallNotice(res.msg)) {
        this.installNotice?.close()
        this.installNotice = ElMessage({
          message: I18nT('base.webPanelFirstInstall', { service: res.msg.service }),
          type: 'info',
          duration: 0,
          showClose: true
        })
      }
      return
    }

    this.complete(key)
    if (res?.code === 0 && res.data?.url) {
      shell.openExternal(res.data.url).catch()
      return
    }
    MessageError(res?.msg ?? 'DbGate failed to start')
  }

  private complete(key?: string) {
    this.installNotice?.close()
    this.installNotice = undefined
    if (key) IPC.off(key)
    this.opening.value = false
  }
}

export default new DbGatePanel()
