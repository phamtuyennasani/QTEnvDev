import { reactiveBind } from '@/util/Index'
import type {
  SharpConfig,
  TextureOptions,
  WatermarkConfig
} from '../../../../fork/module/Image/imageCompress.type'
import type { FitEnum, KernelEnum } from 'sharp'
import { dialog, fs, shell } from '@/util/NodeFn'
import { MessageError } from '@/util/Element'
import { I18nT } from '@lang/index'
import IPC from '@/util/IPC'
import localForage from 'localforage'
import { ImageBatchOperation } from './ImageBatchOperation'
import { snapshotImageConfig } from './ImagePipelineConfig'
import { StorageGetAsync, StorageSetAsync } from '@/util/Storage'
import { watch } from 'vue'

class ImageCompressSetup implements SharpConfig {
  // 基本配置
  width?: number
  height?: number
  fit: keyof FitEnum = 'cover'
  position: number | string = 'centre'
  kernel: keyof KernelEnum = 'cubic'
  withoutEnlargement: boolean = true
  withoutReduction: boolean = false
  fastShrinkOnLoad: boolean = true
  format: NonNullable<SharpConfig['format']> = 'none'
  compressOpen: boolean = true
  // 裁剪配置
  trim?: boolean

  // 水印配置
  watermark: WatermarkConfig = {
    type: 'text',
    enabled: false,
    content: {
      text: '水印',
      fontSize: 44,
      color: 'rgb(128, 128, 128)',
      opacity: 0.6
    },
    position: {
      horizontal: 'center',
      vertical: 'middle',
      offsetX: 20,
      offsetY: 20
    },
    repeat: 'single',
    spacing: 100
  }

  // 纹理配置
  texture: TextureOptions = {
    enabled: false,
    type: 'grid',
    color: 'rgba(128,128,128,0.4)',
    size: 20,
    lineWidth: 1,
    dotSize: 3,
    intensity: 0.05,
    blendMode: 'over',
    opacity: 0.3,
    angle: 0,
    scale: 1
  }

  // 图片格式配置
  jpeg: {
    quality?: number
    progressive?: boolean
    chromaSubsampling?: '4:2:0' | '4:4:4' | '4:2:2'
    optimiseCoding?: boolean
    mozjpeg?: boolean
    trellisQuantisation?: boolean
    optimiseScans?: boolean
  } = {
    quality: 80,
    progressive: true,
    chromaSubsampling: '4:2:0',
    optimiseCoding: true,
    mozjpeg: true,
    trellisQuantisation: false,
    optimiseScans: false
  }

  png: {
    quality?: number
    progressive?: boolean
    compressionLevel?: number
    adaptiveFiltering?: boolean
    palette?: boolean
    colours?: number
    dither?: number
  } = {
    quality: 80,
    progressive: false,
    compressionLevel: 6,
    adaptiveFiltering: true,
    palette: false,
    colours: 256
  }

  webp: {
    quality?: number
    alphaQuality?: number
    lossless?: boolean
    nearLossless?: boolean
    smartSubsample?: boolean
    effort?: number
  } = {
    quality: 80,
    alphaQuality: 100,
    lossless: false,
    nearLossless: false,
    smartSubsample: true,
    effort: 4
  }

  avif: {
    quality?: number
    lossless?: boolean
    effort?: number
    chromaSubsampling?: '4:2:0' | '4:4:4'
  } = {
    quality: 50,
    lossless: false,
    effort: 4,
    chromaSubsampling: '4:2:0'
  }

  gif: {
    pageHeight?: number
    loop?: number
    delay?: number[]
    effort?: number
  } = {
    pageHeight: 0,
    loop: 0,
    delay: [100],
    effort: 7
  }

  tiff: {
    quality?: number
    compression?: 'jpeg' | 'deflate' | 'ccittfax4' | 'lzw' | 'packbits' | 'webp' | 'zstd'
    predictor?: 'none' | 'horizontal' | 'float'
    pyramid?: boolean
    tile?: boolean
    tileWidth?: number
    tileHeight?: number
    xres?: number
    yres?: number
  } = {
    quality: 80,
    compression: 'jpeg',
    predictor: 'horizontal',
    pyramid: false,
    tile: false,
    tileWidth: 256,
    tileHeight: 256,
    xres: 1.0,
    yres: 1.0
  }

  heif: {
    quality?: number
    compression?: 'av1' | 'hevc'
    lossless?: boolean
    effort?: number
    chromaSubsampling?: '4:2:0' | '4:4:4'
  } = {
    quality: 50,
    compression: 'hevc',
    lossless: false,
    effort: 4,
    chromaSubsampling: '4:2:0'
  }

  // 超时和元数据配置
  timeoutSeconds: number = 30
  withMetadata: boolean = false
  withIccProfile: string = 'srgb'

  // 图片处理配置
  rotate: number = 0
  flip: boolean = false
  flop: boolean = false
  blur: number = 0
  sharpen: {
    sigma: number
  } = {
    sigma: 0
  }
  gamma: number = 1
  grayscale: boolean = false
  normalise: boolean = false
  clahe: {
    width: number
    height: number
    maxSlope?: number
  } = {
    width: 8,
    height: 8,
    maxSlope: 3
  }
  negate: boolean = false
  median: number = 0
  modulate: {
    brightness?: number
    saturation?: number
    hue?: number
    lightness?: number
  } = {
    brightness: 1,
    saturation: 1,
    hue: 0,
    lightness: 0
  }
  threshold: {
    enabled: boolean
    value: number
  } = {
    enabled: false,
    value: 128
  }
  toColorspace: 'srgb' | 'rgb' | 'cmyk' | 'lab' | 'b-w' = 'srgb'
  removeAlpha: boolean = false
  ensureAlpha: number = 1.0
  opacity: number = 1

  download(base64: string) {
    let ext = 'png'
    const mimeToExt: any = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/avif': 'avif'
    }
    for (const key in mimeToExt) {
      if (base64.includes(key)) {
        ext = mimeToExt[key]
      }
    }
    dialog
      .showSaveDialog({
        properties: ['createDirectory', 'showOverwriteConfirmation'],
        defaultPath: `qtenvdev-compress-test.${ext}`
      })
      .then(({ canceled, filePath }: any) => {
        if (canceled || !filePath) {
          return
        }
        const data = base64.replace(/^data:image\/\w+;base64,/, '')
        fs.writeBufferBase64(filePath, data)
          .then(() => {
            shell.showItemInFolder(filePath).catch()
          })
          .catch(() => {
            MessageError(I18nT('base.fail'))
          })
      })
  }
}
const setup = reactiveBind(new ImageCompressSetup())
export default setup

class ImageBatchProcess extends ImageBatchOperation {
  wordWidths: Record<string, number> = {}
  private initialized?: Promise<void>
  private storageKey = 'qtenvdev-tools-imagecompress-v2'
  private saves = Promise.resolve()
  private watching = false
  constructor() {
    super({ ipc: IPC, config: () => setup, notice: (message) => MessageError(message) })
  }
  init() {
    if (this.initialized) return this.initialized
    this.initialized = (async () => {
      try {
        const saved = await StorageGetAsync<{ config?: SharpConfig; trialStartTime?: number; saveDir?: string; backupDir?: string; rewrite?: boolean }>(this.storageKey)
          ?? await localForage.getItem<any>('qtenvdev-tools-imagecompress')
        if (saved?.config) Object.assign(setup, snapshotImageConfig({ ...setup, ...saved.config, withIccProfile: typeof saved.config.withIccProfile === 'boolean' ? saved.config.withIccProfile ? 'srgb' : '' : saved.config.withIccProfile ?? setup.withIccProfile }))
        this.trialStartTime = saved?.trialStartTime ?? 0
        this.saveDir = saved?.saveDir ?? ''
        this.backupDir = saved?.backupDir ?? ''
        this.rewrite = Boolean(saved?.rewrite)
      } catch (error) { this.warnings.push('Image settings could not be loaded: ' + String(error)) }
      if (!this.watching) {
        this.watching = true
        watch(() => [setup, this.saveDir, this.backupDir, this.rewrite], () => this.save(), { deep: true })
      }
    })()
    return this.initialized
  }
  save() {
    let data: unknown
    try { data = { config: snapshotImageConfig(setup), trialStartTime: this.trialStartTime, saveDir: this.saveDir, backupDir: this.backupDir, rewrite: this.rewrite } }
    catch { return this.saves }
    this.saves = this.saves.then(() => StorageSetAsync(this.storageKey, data)).catch((error) => { this.warnings.push('Image settings could not be saved: ' + String(error)) })
    return this.saves
  }
  getWordWidths(word: string) {
    for (const character of new Set([...word, '.'])) {
      if (this.wordWidths[character]) continue
      const element = document.createElement('span')
      element.textContent = character
      element.style.opacity = '0'
      element.style.pointerEvents = 'none'
      document.body.appendChild(element)
      this.wordWidths[character] = element.getBoundingClientRect().width
      element.remove()
    }
  }
  async selectDir(type?: 'file' | 'folder') {
    if (this.busy) return
    try {
      const result = await dialog.showOpenDialog({
        properties: type === 'file' ? ['openFile', 'showHiddenFiles', 'multiSelections'] : type === 'folder' ? ['openDirectory', 'showHiddenFiles', 'multiSelections'] : ['openFile', 'openDirectory', 'showHiddenFiles', 'multiSelections'],
        filters: type === 'file' ? [{ name: 'Image files', extensions: ['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif', 'tiff', 'heif'] }] : []
      })
      if (!result.canceled && !this.busy) this.imageSelected(result.filePaths)
    } catch (error) { this.error = String(error); MessageError(this.error) }
  }
  async selectSaveDir(type: 'save' | 'backup') {
    if (this.busy) return
    try {
      const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'showHiddenFiles', 'createDirectory', 'promptToCreate'] })
      if (result.canceled || !result.filePaths[0] || this.busy) return
      if (type === 'save') this.saveDir = result.filePaths[0]
      else this.backupDir = result.filePaths[0]
      this.save()
    } catch (error) { this.error = String(error); MessageError(this.error) }
  }
  async openOutput() {
    try { const error = await shell.openPath(this.rewrite ? this.backupDir : this.saveDir); if (error) this.warnings.push('Files were preserved, but the output folder could not be opened: ' + String(error)) }
    catch (error) { this.warnings.push('Files were preserved, but the output folder could not be opened: ' + String(error)) }
  }
}
export const ImageBatch = reactiveBind(new ImageBatchProcess())
