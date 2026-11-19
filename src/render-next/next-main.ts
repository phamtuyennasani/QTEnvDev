import { createApp } from 'vue'
import { reactive } from 'vue'
import { createPinia } from 'pinia'
import IPC from '@/util/IPC'
import { AppStore } from '@/store/app'
import GlobalIPCOn from '@/util/GlobalIPCOn'
import { AppCustomerModule } from '@/core/Module'
import { markDataDirectoryReady, waitForDataDirectoryReady } from '@/core/DataDirectoryStartup'
import { RendererLanguage } from '@/core/LanguageService'
import { SetupStore } from '@/components/Setup/store'
import { capturerController } from './state/capturerController'

import './styles/app.css'
import geistUrl from './assets/fonts/geist/Geist[wght].ttf?url'
import monoUrl from './assets/fonts/jetbrainsmono/JetBrainsMono[wght].ttf?url'

const fontStyle = document.createElement('style')
fontStyle.textContent = `@font-face { font-family: Geist; src: url('${geistUrl}') format('truetype'); font-weight: 100 900; } @font-face { font-family: 'JetBrains Mono'; src: url('${monoUrl}') format('truetype'); font-weight: 100 900; }`
document.head.appendChild(fontStyle)

// The next surface has its own shell, but it uses the established domain stores and IPC contract.
// Mounting after APP-Ready-To-Show prevents package/service adapters from observing an empty host.
window.Server = reactive({}) as any
const pinia = createPinia()
let mounted = false
let initializing = false
const mount = async () => {
  if (mounted) return
  const { default: AppNext } = await import('./AppNext.vue')
  mounted = true
  const app = createApp(AppNext)
  app.use(pinia)
  app.mount('#pqt-forge-app')
  if (window.QTEnvDevNodeAPI) {
    const { installTrayBridge, runTrayDefault } = await import('./state/trayBridge')
    installTrayBridge()
    IPC.send('application:renderer-initialized')
    const { autoHide, autoStartService } = AppStore(pinia).config.setup
    if (autoHide) IPC.send('APP:Auto-Hide')
    if (autoStartService) void waitForDataDirectoryReady().then(() => runTrayDefault(false))
  }
}
const initialize = async (snapshot: any) => {
  if (initializing || mounted) return
  initializing = true
  Object.assign(window.Server, snapshot ?? {})
  if (window.Server.DataDirectoryReady) markDataDirectoryReady()
  try {
    const store = AppStore(pinia)
    store.envIndex += 1
    await store.initConfig()
    await SetupStore(pinia).init()
    if (window.QTEnvDevNodeAPI) await capturerController.init()
    AppCustomerModule.init().catch(console.error)
    if (!GlobalIPCOn.inited) {
      GlobalIPCOn.inited = true
      GlobalIPCOn.init()
    }
    try {
      const language = await RendererLanguage.initialize()
      store.config.setup.lang = language.locale
      if (language.warning) window.dispatchEvent(new CustomEvent('pqt-notice', { detail: language.warning }))
    } catch (error) {
      window.dispatchEvent(new CustomEvent('pqt-notice', { detail: String(error) }))
    }
  } catch (error) {
    window.dispatchEvent(new CustomEvent('pqt-notice', { detail: `Startup could not load the saved environment: ${error instanceof Error ? error.message : String(error)}` }))
  } finally {
    try {
      await mount()
    } finally {
      initializing = false
    }
  }
}
IPC.on('APP-Ready-To-Show').then((_key: string, snapshot: any) => { void initialize(snapshot) })
IPC.on('APP-Data-Directory-Ready').then((_key: string, ready: boolean) => { if (ready) { window.Server.DataDirectoryReady = true; markDataDirectoryReady() } })
// A web preview can still render when opened directly from Vite; Electron always supplies the event.
setTimeout(() => { if (!mounted && !window.QTEnvDevNodeAPI) void initialize({ DataDirectoryReady: false }) }, 1500)
