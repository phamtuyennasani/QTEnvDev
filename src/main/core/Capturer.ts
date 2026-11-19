import {
  BrowserWindow,
  clipboard,
  desktopCapturer,
  dialog,
  globalShortcut,
  nativeImage,
  Rectangle,
  screen,
  shell
} from 'electron'
import { Window, windowManager } from '@xpf0000/node-window-manager'
import { join } from 'node:path'
import is from 'electron-is'
import { ViteDevPort } from '../../../configs/vite.port'
import { isWindows } from '@shared/utils'
import { mkdirp, readdir, writeFile } from '@shared/fs-extra'
import { randomUUID } from 'node:crypto'
import { I18nT } from '@lang/runtime'
import { getRendererResourcePath } from '../utils/AppRuntimePath'
import { CAPTURER_MAX_BYTES, CAPTURER_MAX_PIXELS, capturerFileName, validateCapturerName, type CapturerEvent } from '@shared/CapturerContract'

const index = getRendererResourcePath('capturer', 'capturer.html')

type WindowItem = {
  id: string
  name: string
  display_id: string
  display?: {
    bounds: Rectangle
    workArea: Rectangle
    scaleFactor: number
  }
}

type WindowBoundAndInfo = {
  id: number
  bounds: Rectangle
  name: string
}

type CapturerConfig = {
  key: string[]
  dir: string
  name: string
}

class Capturer {
  private callback?: (event: CapturerEvent) => void
  private captureState: CapturerEvent = { id: '', status: 'idle' }
  private captureConfig?: CapturerConfig
  private saveFlight?: Promise<CapturerEvent>
  private writing = false
  setCallback(callback: (event: CapturerEvent) => void) { this.callback = callback }
  status() { return { ...this.captureState } }
  private publish(status: CapturerEvent['status'], extra: Partial<CapturerEvent> = {}) {
    this.captureState = { id: this.captureState.id, status, ...extra }
    this.callback?.(this.status())
  }
  isFullScreen: boolean = false
  useWindow: boolean = true
  capturerWindow: Window | undefined = undefined
  capturerWindowID: number = 0
  capturering: boolean = false
  destroyTimer: NodeJS.Timeout | undefined = undefined
  timer: NodeJS.Timeout | undefined = undefined
  window: BrowserWindow | undefined = undefined
  currentPoint: {
    x: number
    y: number
  } = {
    x: 0,
    y: 0
  }
  windows: Record<number, WindowBoundAndInfo> = {}
  needCheckWindowInPoint: boolean = true
  config: CapturerConfig = {
    key: [],
    name: '',
    dir: ''
  }

  windowImage: Record<number, string> | null = null

  private handleWindowLoadError(window: BrowserWindow, error: unknown) {
    this.publish('failed', { error: error instanceof Error ? error.message : String(error) })
    globalShortcut.unregister('Escape')
    this.windowImage = null
    this.capturering = false
    if (this.window === window) {
      this.window = undefined
    }
    if (!window.isDestroyed()) {
      window.destroy()
    }
    const message = error instanceof Error ? error.message : `${error}`
    dialog.showErrorBox(
      I18nT('tools.CapturerFailTitle'),
      `${I18nT('tools.CapturerFailContent')}\n\n${message}`
    )
  }

  stopCapturer(reason: 'cancelled' | 'saving' = 'cancelled') {
    if (this.writing) return this.status()
    const active = ['opening', 'opened', 'saving'].includes(this.captureState.status)
    globalShortcut.unregister('Escape')
    this.windowImage = null
    clearInterval(this.timer)
    this.timer = undefined
    if (!this.window?.isDestroyed()) this.window?.hide()
    this.isFullScreen = false
    clearTimeout(this.destroyTimer)
    this.destroyTimer = setTimeout(
      () => {
        if (!this.window?.isDestroyed()) this.window?.destroy()
        this.window = undefined
        this.capturerWindowID = 0
        this.capturerWindow = undefined
      },
      2 * 60 * 1000
    )
    if (!this.window?.isDestroyed()) this.window?.webContents?.send?.(
      'command',
      'APP:Capturer-Window-Clean',
      'APP:Capturer-Window-Clean'
    )
    this.capturering = false
    if (active) this.publish(reason)
    return this.status()
  }

  getWindowCapturer(id: number) {
    let image: string = ''
    if (this.windowImage?.[id]) {
      console.log('getWindowCapturer this.windowImage?.[id]: ', id)
      image = this.windowImage[id]
    } else {
      image = windowManager.captureWindow(id)
    }
    console.log('getWindowCapturer image: ', image.length)
    if (image) {
      this.window?.webContents?.send?.(
        'command',
        'APP:Capturer-Window-Image-Get',
        'APP:Capturer-Window-Image-Get',
        {
          id,
          image
        }
      )
    }
  }

  async initWatchPointWindow(operationId = randomUUID()) {
    if (this.capturering || ['opening', 'opened', 'saving'].includes(this.captureState.status)) throw new Error('A capture is already active')
    try { return await this.openCaptureWindow(operationId) }
    catch (error) {
      this.stopCapturer()
      this.publish('failed', { error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  private async openCaptureWindow(operationId: string) {
    this.captureState = { id: operationId, status: 'opening' }
    this.captureConfig = { ...this.config, key: [...this.config.key] }
    this.publish('opening')
    globalShortcut.register('Escape', () => {
      this.stopCapturer()
    })
    this.windowImage = {}
    this.capturering = true
    clearTimeout(this.destroyTimer)
    clearInterval(this.timer)
    this.windows = {}
    this.needCheckWindowInPoint = true

    let base64Image = ''
    const title = 'QTEnvDev-Capturer-Window-I3MCDmGbp2IJy9T69RHFs7p0mwGg1WHB'
    const display = screen.getPrimaryDisplay()
    if (Math.floor(display.bounds.width * display.scaleFactor) * Math.floor(display.bounds.height * display.scaleFactor) > CAPTURER_MAX_PIXELS) throw new Error('The desktop exceeds the 100 megapixel capture limit.')
    console.log('scaleFactor: ', display.scaleFactor)
    console.log('原始bounds:', display.bounds)
    let screenRect = undefined

    const captureActiveWindow = () => {
      const point = screen.getCursorScreenPoint()
      if (point.x === this.currentPoint.x && point.y === this.currentPoint.y) {
        return
      }
      this.currentPoint.x = point.x
      this.currentPoint.y = point.y
      let x = point.x
      let y = point.y
      if (isWindows()) {
        x = Math.floor(x * display.scaleFactor)
        y = Math.floor(y * display.scaleFactor)
      }
      const pointWindow = windowManager.getWindowAtPoint(x, y, this.capturerWindowID)
      if (pointWindow.id && this.windowImage) {
        this.windowImage[pointWindow.id] = windowManager.captureWindow(pointWindow.id)
      }
    }
    captureActiveWindow()

    if (isWindows()) {
      try {
        const deskID = windowManager.getDesktopWindowID()
        base64Image = windowManager.captureWindow(deskID)
      } catch {
        this.stopCapturer()
        this.publish('failed', { error: 'The desktop image could not be captured.' })
        dialog.showErrorBox(I18nT('tools.CapturerFailTitle'), I18nT('tools.CapturerFailContent'))
        throw new Error('The desktop image could not be captured.')
      }
      screenRect = {
        x: 0,
        y: 0,
        width: Math.floor(display.bounds.width * display.scaleFactor),
        height: Math.floor(display.bounds.height * display.scaleFactor)
      }
      console.log('Desktop Bounds:', screenRect)
    } else {
      const getScreenThumbnail = async (retry = 0) => {
        if (retry > 2) {
          return false
        }
        try {
          const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: {
              width: Math.floor(display.bounds.width * display.scaleFactor),
              height: Math.floor(display.bounds.height * display.scaleFactor)
            }
          })
          console.log('desktopCapturer.getSources sources: ', sources)
          const image = sources[0].thumbnail
          base64Image = image.toDataURL()
          console.log('desktopCapturer.getSources base64Image: ', base64Image.length)
          if (base64Image.length < 500) {
            return await getScreenThumbnail(retry + 1)
          }
          return true
        } catch (e) {
          console.error('desktopCapturer.getSources error: ', e)
          return await getScreenThumbnail(retry + 1)
        }
      }
      const res = await getScreenThumbnail(0)
      if (!res) {
        this.stopCapturer()
        this.publish('failed', { error: 'The desktop image could not be captured.' })
        dialog.showErrorBox(I18nT('tools.CapturerFailTitle'), I18nT('tools.CapturerFailContent'))
        throw new Error('The desktop image could not be captured.')
      }
      screenRect = {
        x: 0,
        y: 0,
        width: Math.floor(display.bounds.width * display.scaleFactor),
        height: Math.floor(display.bounds.height * display.scaleFactor)
      }
    }

    if (this.captureState.status !== 'opening' || this.captureState.id !== operationId) return this.status()
    const init = (window: BrowserWindow) => {
      if (this.captureState.status !== 'opening' || this.captureState.id !== operationId) return
      this.isFullScreen = false
      window.setAlwaysOnTop(true, 'screen-saver')
      // window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      window.show()
      setTimeout(() => {
        window.setAlwaysOnTop(true, 'screen-saver')
      }, 100)
      window.focus()
      window.moveTop()
      window.webContents?.send?.(
        'command',
        'APP:Capturer-Window-Screen-Image-Update',
        'APP:Capturer-Window-Screen-Image-Update',
        {
          image: base64Image,
          screenRect,
          scaleFactor: display.scaleFactor
        }
      )
      if (!this.capturerWindowID) {
        const all = windowManager.getWindows()
        console.log('windowManager.getWindows all: ', all)
        const find = all.find((a) => a.getName().includes(title))
        this.capturerWindow = find
        const activeId = find?.id ?? 0
        console.log('find: ', activeId, find?.getName())
        this.capturerWindowID = activeId
      }
      if (!this.isFullScreen && isWindows()) {
        if (this.capturerWindow) {
          this.isFullScreen = true
          this.capturerWindow?.setFullScreen()
        }
      }

      const fetchTopWindow = () => {
        if (!this.needCheckWindowInPoint) {
          clearInterval(this.timer)
          return
        }
        const point = screen.getCursorScreenPoint()
        if (point.x === this.currentPoint.x && point.y === this.currentPoint.y) {
          return
        }
        this.currentPoint.x = point.x
        this.currentPoint.y = point.y
        let x = point.x
        let y = point.y
        if (isWindows()) {
          x = Math.floor(x * display.scaleFactor)
          y = Math.floor(y * display.scaleFactor)
        }
        const pointWindow = windowManager.getWindowAtPoint(x, y, this.capturerWindowID)
        console.log(
          'getWindowAtPoint: ',
          {
            x,
            y
          },
          pointWindow.id,
          pointWindow.getTitle(),
          pointWindow.getName()
        )
        if (pointWindow.id) {
          let item = this.windows?.[pointWindow.id]
          console.log('getWindowAtPoint item: ', item)
          if (!item) {
            const bounds: Rectangle = pointWindow.getBounds() as any
            const name = pointWindow.getName()
            if (isWindows()) {
              bounds.x /= display.scaleFactor
              bounds.y /= display.scaleFactor
              bounds.width /= display.scaleFactor
              bounds.height /= display.scaleFactor
            }
            item = {
              id: pointWindow.id,
              bounds,
              name
            }
            this.windows[pointWindow.id] = item
          }
          window.webContents?.send?.(
            'command',
            'APP:Capturer-Window-Rect-Update',
            'APP:Capturer-Window-Rect-Update',
            JSON.parse(JSON.stringify(item))
          )
        } else {
          const item = {
            id: -1,
            bounds: {
              x: 0,
              y: 0,
              width: display.bounds.width,
              height: display.bounds.height
            },
            name: 'Full Screen'
          }
          window.webContents?.send?.(
            'command',
            'APP:Capturer-Window-Rect-Update',
            'APP:Capturer-Window-Rect-Update',
            item
          )
        }
      }
      fetchTopWindow()
      this.timer = setInterval(() => {
        fetchTopWindow()
      }, 150)
      this.publish('opened')
    }

    if (this.window) {
      init(this.window)
      return this.status()
    }

    const window = new BrowserWindow({
      x: 0,
      // 向上移动窗口，使其顶部覆盖菜单栏
      y: 0,
      type: 'toolbar',
      width: display.bounds.width,
      height: display.bounds.height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      hasShadow: false,
      skipTaskbar: true,
      enableLargerThanScreen: true,
      title,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        backgroundThrottling: false, // 禁止后台节流
        preload: join(global.Server.Static!, 'preload/preload.js')
      }
    })

    window.setMenu(null)

    const loadPage = is.dev()
      ? window.loadURL(`http://localhost:${ViteDevPort}/capturer/capturer.html`)
      : window.loadFile(index)
    void loadPage.catch((error) => {
      this.handleWindowLoadError(window, error)
    })
    window.once('ready-to-show', () => {
      init(window)
    })
    window.on('show', () => {
      console.log('window show !!!!!!')
      if (!this.isFullScreen && isWindows()) {
        if (this.capturerWindow) {
          this.isFullScreen = true
          this.capturerWindow?.setFullScreen()
        }
      }
    })
    this.window = window
    window.once('closed', () => { if (this.window !== window) return; this.window = undefined; if (['opening', 'opened'].includes(this.captureState.status)) this.stopCapturer() })
    return this.status()
  }

  stopCheckWindowInPoint() {
    this.needCheckWindowInPoint = false
    clearInterval(this.timer)
  }

  async getAllWindows(): Promise<WindowItem[]> {
    try {
      const displays = screen.getAllDisplays()
      console.log('getAllWindows displays', displays)
      const sources = await desktopCapturer.getSources({
        types: ['window']
      })

      const all = sources.map((source) => {
        console.log('getAllWindows source', source)
        // 根据display_id找到对应的显示器
        const display = displays.find((d) => d.id.toString() === source.display_id)
        return {
          id: source.id,
          name: source.name,
          display_id: source.display_id,
          display: display
            ? {
                bounds: display.bounds,
                workArea: display.workArea,
                scaleFactor: display.scaleFactor
              }
            : undefined
        }
      })
      console.log('getAllWindows all: ', all)
      return all
    } catch (error) {
      console.error('获取窗口位置失败:', error)
      return []
    }
  }

  saveImage(base64: string, userConfig?: boolean): Promise<CapturerEvent> {
    if (this.saveFlight) return this.saveFlight
    if (!['opened', 'saving'].includes(this.captureState.status)) return Promise.reject(new Error('There is no active capture to save.'))
    this.saveFlight = this.writeImage(base64, userConfig).finally(() => { this.saveFlight = undefined; this.writing = false })
    return this.saveFlight
  }

  private async writeImage(base64: string, userConfig?: boolean) {
    this.publish('saving')
    try {
      if (typeof base64 !== 'string' || base64.length > Math.ceil(CAPTURER_MAX_BYTES * 4 / 3) + 4) throw new Error('Capture exceeds the 50 MB file limit.')
      const buffer = Buffer.from(base64, 'base64')
      if (buffer.length > CAPTURER_MAX_BYTES || buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Capture must be a PNG image below 50 MB.')
      const width = buffer.readUInt32BE(16); const height = buffer.readUInt32BE(20)
      if (!width || !height || width * height > CAPTURER_MAX_PIXELS) throw new Error('Capture exceeds the 100 megapixel limit.')
      const image = nativeImage.createFromBuffer(buffer)
      if (image.isEmpty()) throw new Error('The capture image could not be decoded.')
      const config = this.captureConfig ?? this.config
      let filePath: string
      let exclusive = false
      const date = new Date(); const id = randomUUID()
      if (userConfig && config.dir) {
        validateCapturerName(config.name)
        await mkdirp(config.dir)
        const existing = new Set((await readdir(config.dir)).map((name) => name.toLowerCase()))
        let index = existing.size + 1
        let name = capturerFileName(config.name, index, date, id)
        while (existing.has(name.toLowerCase())) {
          if (!config.name.includes('{index}')) throw new Error('The capture file already exists. Use {index} or {uuid} in the name pattern.')
          name = capturerFileName(config.name, ++index, date, id)
        }
        filePath = join(config.dir, name)
        exclusive = true
      } else {
        const result = await dialog.showSaveDialog({
          properties: ['showHiddenFiles', 'createDirectory', 'showOverwriteConfirmation'],
          defaultPath: capturerFileName('qtenvdev-capturer-{timestamp}', 1, date, id),
          filters: [{ name: 'PNG Files', extensions: ['png'] }]
        })
        if (result.canceled || !result.filePath) { this.publish('cancelled'); return this.status() }
        filePath = result.filePath
      }
      if (this.captureState.status === 'cancelled') return this.status()
      this.writing = true
      await writeFile(filePath, buffer, exclusive ? { flag: 'wx' } : undefined)
      const warnings: string[] = []
      try { clipboard.writeImage(image) } catch (error) { warnings.push('Clipboard copy failed: ' + String(error)) }
      try { shell.showItemInFolder(filePath) } catch (error) { warnings.push('Reveal file failed: ' + String(error)) }
      this.publish('saved', { path: filePath, warning: warnings.join(' ') || undefined })
      return this.status()
    } catch (error) {
      this.publish('failed', { error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }
  configUpdate(config: CapturerConfig) {
    validateCapturerName(config.name)
    if (this.config.key.length) {
      globalShortcut.unregister(this.config.key.join('+'))
    }
    this.config = { ...config, key: [...config.key] }
    if (this.config.key.length) {
      const registered = globalShortcut.register(this.config.key.join('+'), () => {
        if (this.capturering) {
          return
        }
        this.initWatchPointWindow().catch((error) => this.publish('failed', { error: String(error) }))
      })
      if (!registered) throw new Error('The capture shortcut could not be registered. It may already be in use.')
    }
  }
}

export default new Capturer()
