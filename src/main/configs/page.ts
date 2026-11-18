import is from 'electron-is'
import { ViteDevPort } from '../../../configs/vite.port'
import { getRendererResourcePath } from '../utils/AppRuntimePath'
import BrowserWindowConstructorOptions = Electron.BrowserWindowConstructorOptions

const index = getRendererResourcePath('index.html')
const tray = getRendererResourcePath('tray.html')
const next = getRendererResourcePath('next.html')
// PQT Forge is the primary renderer. Set PQT_FORGE_NEXT_RENDERER=0 only for a
// temporary legacy fallback while comparing or diagnosing the old shell.
const useNextRenderer = process.env.PQT_FORGE_NEXT_RENDERER !== '0'

interface PageOptions {
  [key: string]: {
    attrs: BrowserWindowConstructorOptions
    bindCloseToHide: boolean
    url: string
  }
}

const options: PageOptions = {
  index: {
    attrs: {
      title: useNextRenderer ? 'PQT Forge' : 'QTEnvDev',
      // PQT Forge owns its titlebar and window controls. Keep the legacy
      // renderer on Electron's native frame when explicitly selected.
      frame: useNextRenderer ? false : undefined,
      width: useNextRenderer ? 1200 : 1200,
      height: useNextRenderer ? 800 : 800,
      minWidth: useNextRenderer ? 1000 : 1000,
      minHeight: useNextRenderer ? 700 : 700,
      maxWidth: useNextRenderer ? 1200 : undefined,
      maxHeight: useNextRenderer ? 800 : undefined
    },
    bindCloseToHide: true,
    url: is.dev()
      ? `http://localhost:${ViteDevPort}${useNextRenderer ? '/render-next/next.html' : '/render/index.html'}`
      : useNextRenderer
        ? next
        : index
  },
  tray: {
    attrs: {},
    bindCloseToHide: true,
    url: is.dev() ? `http://localhost:${ViteDevPort}/render/tray.html` : tray
  }
}

export default options
