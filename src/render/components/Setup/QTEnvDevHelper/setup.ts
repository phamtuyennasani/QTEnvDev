import { reactive } from 'vue'
import IPC from '@/util/IPC'
import { ElMessage } from 'element-plus'
import { I18nT } from '@lang/index'
import { QTEnvDevHelperSetup } from '@/components/QTEnvDevHelper/setup'

export const QTEnvDevHelperFix = reactive({
  fixing: false,
  doFix() {
    if (this.fixing || QTEnvDevHelperSetup.show || QTEnvDevHelperSetup.loading) {
      return
    }
    this.fixing = true
    if (window.Server.isLinux) {
      // Explicit maintenance also permits approving a new CA on a healthy helper.
      QTEnvDevHelperSetup.open().finally(() => {
        this.fixing = false
      })
      return
    }
    IPC.send('APP:QTEnvDev-Helper-Check').then((key: string, res: any) => {
      IPC.off(key)
      if (res?.code === 0) {
        ElMessage.success(I18nT('setup.qtenvdevHelperFixSuccess'))
      } else if (res?.reason === 'helper_binary_missing') {
        ElMessage.error(I18nT('menu.helperInstallFailTips'))
      } else {
        if (!QTEnvDevHelperSetup.show) {
          QTEnvDevHelperSetup.open()
        }
      }
      this.fixing = false
    })
  }
})
