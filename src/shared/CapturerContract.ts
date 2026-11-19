export type CapturerConfig = { key: string[]; dir: string; name: string; trialStartTime: number }
export type CapturerStatus = 'idle' | 'opening' | 'opened' | 'saving' | 'saved' | 'cancelled' | 'failed'
export type CapturerEvent = { id: string; status: CapturerStatus; path?: string; error?: string; warning?: string }
export const CAPTURER_MAX_BYTES = 50 * 1024 * 1024
export const CAPTURER_MAX_PIXELS = 100_000_000
export const validateCapturerName = (value: string) => {
  const name = value.trim()
  if (name.length > 180 || /[<>:"/\\|?*\x00-\x1f]/.test(name) || name === '.' || name === '..' || /[. ]$/.test(name)) throw new Error('Capture name must be a file name without path separators or reserved characters.')
  if (/\{(?!index\}|timestamp\}|datetime\}|uuid\})[^}]*\}/.test(name) || /[{}]/.test(name.replace(/\{(?:index|timestamp|datetime|uuid)\}/g, ''))) throw new Error('Capture name contains an unsupported token.')
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) throw new Error('Capture name is reserved by Windows.')
  return name
}
export const capturerFileName = (pattern: string, index: number, date: Date, uuid: string) => {
  const name = validateCapturerName(pattern) || 'qtenvdev-capturer-{timestamp}'
  const resolved = name.replace(/\{index\}/g, String(index)).replace(/\{timestamp\}/g, String(Math.floor(date.getTime() / 1000))).replace(/\{datetime\}/g, date.toISOString().replace(/[:.]/g, '-')).replace(/\{uuid\}/g, uuid)
  validateCapturerName(resolved)
  return resolved + '.png'
}
