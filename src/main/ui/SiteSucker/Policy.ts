export type MirrorConfig = {
  dir: string; proxy: string; excludeLink: string; pageLimit: string
  timeout: number; maxImgSize: number; maxVideoSize: number; windowCount: number
  maxRetryTimes: number; maxPages: number; maxFiles: number; maxFileSize: number
  maxTotalSize: number; maxDuration: number
}
export const mirrorDefaults: MirrorConfig = {
  dir: '', proxy: '', excludeLink: '', pageLimit: '', timeout: 30000,
  maxImgSize: 20, maxVideoSize: 100, windowCount: 2, maxRetryTimes: 3,
  maxPages: 100, maxFiles: 1000, maxFileSize: 100, maxTotalSize: 500, maxDuration: 600000
}
const bounded = (value: unknown, fallback: number, min: number, max: number) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.trunc(number))) : fallback
}
export function mirrorConfig(input: Partial<MirrorConfig> = {}): MirrorConfig {
  return {
    dir: typeof input.dir === 'string' ? input.dir.trim() : '',
    proxy: typeof input.proxy === 'string' ? input.proxy.trim() : '',
    excludeLink: typeof input.excludeLink === 'string' ? input.excludeLink : '',
    pageLimit: typeof input.pageLimit === 'string' ? input.pageLimit.trim() : '',
    timeout: bounded(input.timeout, 30000, 1000, 600000),
    maxImgSize: bounded(input.maxImgSize, 20, 1, 2048),
    maxVideoSize: bounded(input.maxVideoSize, 100, 1, 4096),
    windowCount: bounded(input.windowCount, 2, 1, 8),
    maxRetryTimes: bounded(input.maxRetryTimes, 3, 1, 5),
    maxPages: bounded(input.maxPages, 100, 1, 10000),
    maxFiles: bounded(input.maxFiles, 1000, 1, 10000),
    maxFileSize: bounded(input.maxFileSize, 100, 1, 4096),
    maxTotalSize: bounded(input.maxTotalSize, 500, 1, 16384),
    maxDuration: bounded(input.maxDuration, 600000, 1000, 3600000)
  }
}
export function mirrorUrl(value: string, base?: string): URL {
  const url = new URL(value, base)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use an HTTP(S) URL without embedded credentials')
  }
  url.hash = ''
  return url
}
