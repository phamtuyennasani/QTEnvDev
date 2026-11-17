import BrowserWindowConstructorOptions = Electron.BrowserWindowConstructorOptions

export interface PageOptions {
  attrs: BrowserWindowConstructorOptions
  bindCloseToHide: boolean
  url: string
}

export interface WorkAreaSize {
  width: number
  height: number
}

export function createScaledPageOptions(
  pageOptions: PageOptions,
  workAreaSize: WorkAreaSize
): PageOptions
export function createScaledPageOptions(
  pageOptions: undefined,
  workAreaSize: WorkAreaSize
): undefined
export function createScaledPageOptions(
  pageOptions: PageOptions | undefined,
  workAreaSize: WorkAreaSize
): PageOptions | undefined {
  if (!pageOptions) {
    return undefined
  }

  const widthScale = workAreaSize.width >= 1280 ? 1 : 0.875
  const heightScale = workAreaSize.height >= 800 ? 1 : 0.875
  const attrs = { ...pageOptions.attrs }
  // Scale the initial size, but preserve the layout's minimum width in DIP.
  const scaledDimensions = [
    ['width', widthScale],
    ['height', heightScale],
    ['minHeight', heightScale]
  ] as const

  for (const [dimension, scale] of scaledDimensions) {
    const value = attrs[dimension]
    if (typeof value === 'number') {
      attrs[dimension] = value * scale
    }
  }

  return {
    ...pageOptions,
    attrs
  }
}
