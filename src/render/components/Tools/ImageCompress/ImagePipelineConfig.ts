import type { SharpConfig } from '../../../../fork/module/Image/imageCompress.type'

const keys = new Set('width height fit position kernel withoutEnlargement withoutReduction fastShrinkOnLoad format compressOpen trim watermark texture jpeg png webp avif gif tiff heif timeoutSeconds withMetadata withIccProfile rotate flip flop blur sharpen gamma grayscale normalise clahe negate median modulate threshold toColorspace removeAlpha ensureAlpha opacity'.split(' '))
const ranges: Record<string, [number, number]> = {
  width: [1, 9999], height: [1, 9999], timeoutSeconds: [1, 600],
  rotate: [-360, 360], blur: [0, 1000], 'sharpen.sigma': [0, 100], gamma: [1, 3],
  median: [0, 1000], ensureAlpha: [0, 1], opacity: [0, 1],
  'threshold.value': [0, 255], 'modulate.brightness': [0, 100], 'modulate.saturation': [0, 100],
  'modulate.hue': [-360, 360], 'modulate.lightness': [-100, 100],
  'texture.opacity': [0, 1], 'texture.intensity': [0, 1], 'texture.scale': [0.1, 5],
  'texture.size': [1, 9999], 'texture.lineWidth': [0, 1000], 'texture.dotSize': [0, 1000],
  'watermark.content.opacity': [0, 1], 'watermark.content.fontSize': [1, 9999],
  'watermark.spacing': [0, 9999], 'png.compressionLevel': [0, 9],
  'png.colours': [2, 256], 'png.dither': [0, 1], 'webp.effort': [0, 6],
  'avif.effort': [0, 9], 'heif.effort': [0, 9], 'gif.effort': [1, 10],
  'gif.loop': [0, 65535], 'gif.pageHeight': [0, 9999],
  'tiff.tileWidth': [1, 9999], 'tiff.tileHeight': [1, 9999],
  'tiff.xres': [0.01, 100000], 'tiff.yres': [0.01, 100000],
  'clahe.width': [1, 9999], 'clahe.height': [1, 9999], 'clahe.maxSlope': [0, 100]
}
const enums: Record<string, readonly unknown[]> = {
  format: ['none', 'jpeg', 'jpg', 'png', 'webp', 'avif', 'gif', 'tiff', 'heif'],
  fit: ['cover', 'contain', 'fill', 'inside', 'outside'],
  kernel: ['nearest', 'linear', 'cubic', 'mitchell', 'lanczos2', 'lanczos3', 'mks2013', 'mks2021'],
  toColorspace: ['srgb', 'rgb', 'cmyk', 'lab', 'b-w'],
  'watermark.type': ['text', 'image'], 'watermark.repeat': ['single', 'repeat', 'grid'],
  'watermark.position.horizontal': ['left', 'center', 'right'],
  'watermark.position.vertical': ['top', 'middle', 'bottom'],
  'texture.type': ['grid', 'dot', 'line', 'cross', 'noise', 'custom'],
  'texture.blendMode': ['overlay', 'multiply', 'screen', 'soft-light', 'hard-light', 'over'],
  'tiff.compression': ['jpeg', 'deflate', 'ccittfax4', 'lzw', 'packbits', 'webp', 'zstd'],
  'tiff.predictor': ['none', 'horizontal', 'float'], 'heif.compression': ['av1', 'hevc'],
  'jpeg.chromaSubsampling': ['4:2:0', '4:4:4', '4:2:2'],
  'avif.chromaSubsampling': ['4:2:0', '4:4:4'], 'heif.chromaSubsampling': ['4:2:0', '4:4:4']
}
const booleans = new Set('withoutEnlargement withoutReduction fastShrinkOnLoad compressOpen trim withMetadata flip flop grayscale normalise negate removeAlpha watermark.enabled texture.enabled threshold.enabled jpeg.progressive jpeg.optimiseCoding jpeg.mozjpeg jpeg.trellisQuantisation jpeg.optimiseScans png.progressive png.adaptiveFiltering png.palette webp.lossless webp.nearLossless webp.smartSubsample avif.lossless heif.lossless tiff.pyramid tiff.tile'.split(' '))
const integers = new Set('width height timeoutSeconds median threshold.value png.compressionLevel png.colours webp.effort avif.effort heif.effort gif.effort gif.loop gif.pageHeight tiff.tileWidth tiff.tileHeight clahe.width clahe.height'.split(' '))

/** Validate before JSON cloning so NaN/Infinity cannot silently become null. */
export function snapshotImageConfig(input: unknown): SharpConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Image options must be an object.')
  const visit = (value: unknown, path: string) => {
    if (value === undefined) return
    if (ranges[path] && typeof value !== 'number') throw new Error(path + ' must be a number.')
    if (booleans.has(path) && typeof value !== 'boolean') throw new Error(path + ' must be a boolean.')
    if (path === 'withIccProfile' && typeof value !== 'string') throw new Error('withIccProfile must be an ICC profile name.')
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error(path + ' must be finite.')
      const range = ranges[path] ?? (/\.(quality|alphaQuality)$/.test(path) ? [1, 100] : undefined)
      if (range && (value < range[0] || value > range[1])) throw new Error(path + ' must be between ' + range.join(' and ') + '.')
      if ((integers.has(path) || /\.(quality|alphaQuality)$/.test(path)) && !Number.isInteger(value)) throw new Error(path + ' must be an integer.')
    } else if (value === null || !['object', 'string', 'boolean'].includes(typeof value)) {
      throw new Error(path + ' contains an unsupported value.')
    }
    if (enums[path] && !enums[path].includes(value)) throw new Error(path + ' has an unsupported value.')
    if (Array.isArray(value)) value.forEach((item, index) => visit(item, path + '.' + index))
    else if (value && typeof value === 'object') for (const [name, child] of Object.entries(value)) visit(child, path ? path + '.' + name : name)
  }
  const data = Object.fromEntries(Object.entries(input).filter(([name]) => keys.has(name)))
  visit(data, '')
  const config = JSON.parse(JSON.stringify(data)) as SharpConfig
  if (config.watermark?.enabled) {
    const content = config.watermark.content as unknown as Record<string, unknown>
    if (config.watermark.type === 'text' && !String(content.text ?? '').trim()) throw new Error('Watermark text is required.')
    if (config.watermark.type === 'image' && !String(content.imagePath ?? '').trim()) throw new Error('Watermark image is required.')
    if (config.watermark.type === 'image') for (const dimension of ['width', 'height']) {
      const value = content[dimension]
      if (value !== undefined && value !== '' && !(typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 9999) && !(typeof value === 'string' && /^\d+(?:\.\d+)?%$/.test(value) && parseFloat(value) > 0 && parseFloat(value) <= 1000)) throw new Error('Watermark ' + dimension + ' must be pixels or a positive percentage.')
    }
  }
  if (config.texture?.enabled && config.texture.type === 'custom' && !config.texture.customImage?.trim()) throw new Error('Custom texture image is required.')
  return config
}
