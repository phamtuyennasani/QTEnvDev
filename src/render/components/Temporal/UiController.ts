import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { BrewStore } from '@/store/brew'
import { forkTerminalRequest, isPositiveHostPid } from '@/util/ForkTerminalRequest'
import { shell } from '@/util/NodeFn'

const RESULT_UNKNOWN =
  'Temporal UI did not report a final result. Check the service before trying again.'

class TemporalUiController {
  readonly opening = ref(false)
  private readonly downloadProgress = ref<number>()
  private resultUnknown = false

  get openingLabel() {
    if (!this.opening.value) return undefined
    const progress = this.downloadProgress.value
    return progress === undefined || progress === 100
      ? 'Opening Temporal UI…'
      : `Downloading Temporal UI (${progress}%)`
  }

  async open(
    reportError = (message: string) => {
      ElMessage.error({ message, showClose: true, customClass: 'app-el-message' })
    }
  ) {
    if (this.opening.value) return false
    if (this.resultUnknown) {
      reportError(RESULT_UNKNOWN)
      return false
    }

    const module = BrewStore().module('temporal')
    const running = module.installed.find((entry) => entry.run && entry.version && entry.bin)
    if (!running) {
      reportError('Start Temporal Server before opening Temporal UI.')
      return false
    }
    const { bin, version } = running
    const snapshot = JSON.parse(JSON.stringify(running))
    this.opening.value = true
    try {
      const reply = await forkTerminalRequest(
        'app-fork:temporal',
        ['openUiServer', snapshot],
        RESULT_UNKNOWN,
        370_000,
        (event: { msg?: { progress?: unknown } }) => {
          const progress = event.msg?.progress
          if (typeof progress === 'number' && Number.isFinite(progress)) {
            this.downloadProgress.value = Math.max(0, Math.min(100, Math.round(progress)))
          }
        }
      )
      if (reply.code !== 0) {
        if (typeof reply.msg === 'string' && /result is unknown/i.test(reply.msg)) {
          throw new Error(RESULT_UNKNOWN)
        }
        throw new Error(typeof reply.msg === 'string' ? reply.msg : 'Temporal UI could not start.')
      }
      if (!isPositiveHostPid(reply.data?.['APP-Service-Start-PID'])) {
        throw new Error(RESULT_UNKNOWN)
      }
      const url = new URL(reply.data?.url)
      if (
        url.protocol !== 'http:' ||
        url.hostname !== '127.0.0.1' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/'
      ) {
        throw new Error('Temporal UI returned an invalid dashboard URL.')
      }
      if (
        !module.installed.some(
          (entry) => entry.run && entry.bin === bin && entry.version === version
        )
      ) {
        throw new Error('The running Temporal installation changed.')
      }
      const result = await shell.openExternalChecked(url.href)
      if (result.code !== 0) throw new Error('The browser could not open Temporal UI.')
      return true
    } catch (error) {
      if (error instanceof Error && error.message === RESULT_UNKNOWN) this.resultUnknown = true
      reportError(error instanceof Error ? error.message : 'Temporal UI could not be opened.')
      return false
    } finally {
      this.opening.value = false
      this.downloadProgress.value = undefined
    }
  }
}

export default new TemporalUiController()
