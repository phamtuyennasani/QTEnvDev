import { I18nT } from '@lang/index'
import { AppStore } from '@/store/app'
import { MessageError } from '@/util/Element'
import { reactiveBind } from '@/util/Index'
import { app } from '@/util/NodeFn'

class AutoLaunchController {
  busy = false

  async syncMac() {
    if (!window.Server.isMacOS || this.busy) return
    this.busy = true
    try {
      const settings = await app.getLoginItemSettings()
      if (typeof settings?.openAtLogin === 'boolean') {
        AppStore().config.setup.autoLaunch = settings.openAtLogin
      }
    } catch {
      // A failed read leaves the last known preference available for the switch.
    } finally {
      this.busy = false
    }
  }

  async setEnabled(enabled: boolean) {
    const store = AppStore()
    if (this.busy || enabled === Boolean(store.config.setup.autoLaunch)) return
    this.busy = true
    try {
      const result = await app.setLoginItemSettings({ openAtLogin: enabled })
      if (result === true) {
        store.config.setup.autoLaunch = enabled
        void store.saveConfig().catch((error) => MessageError(String(error)))
      } else {
        const message =
          typeof result === 'string' ? result : typeof result === 'object' && result?.message
        MessageError(message || I18nT('base.fail'))
      }
    } catch (error) {
      MessageError(error instanceof Error ? error.message : String(error))
    } finally {
      this.busy = false
    }
  }
}

export const autoLaunch = reactiveBind(new AutoLaunchController())
