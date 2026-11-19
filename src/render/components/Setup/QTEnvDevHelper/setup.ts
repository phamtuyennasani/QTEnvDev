import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { I18nT } from '@lang/index'
import { QTEnvDevHelperSetup } from '@/components/QTEnvDevHelper/setup'
import HelperStore from '@/store/helper'
import type { AsyncComponentShow } from '@/util/AsyncComponent'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'

export const QTEnvDevHelperFix = reactive({
  fixing: false,
  get busy() {
    return this.fixing || QTEnvDevHelperSetup.loading || HelperStore.isInstalling()
  },
  async doFix(showDialog: typeof AsyncComponentShow) {
    if (this.busy || QTEnvDevHelperSetup.show) return
    if (!window.Server.isLinux && !window.Server.isMacOS) return
    this.fixing = true
    try {
      if (window.Server.isLinux) {
        // Explicit maintenance also permits approving a new CA on a healthy helper.
        await QTEnvDevHelperSetup.open(showDialog)
        return
      }
      const result = await forkTerminalRequest(
        'APP:QTEnvDev-Helper-Check',
        [],
        I18nT('setup.qtenvdevHelperInstallTimeout'),
        60_000
      )
      if (result.code === 0 && result.data === true) {
        ElMessage.success(I18nT('setup.qtenvdevHelperFixSuccess'))
      } else if (result.reason === 'helper_binary_missing') {
        ElMessage.error(I18nT('menu.helperInstallFailTips'))
      } else {
        await QTEnvDevHelperSetup.open(showDialog)
      }
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : String(error))
    } finally {
      this.fixing = false
    }
  }
})
