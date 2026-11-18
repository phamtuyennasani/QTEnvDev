export type LocalTool = 'json' | 'base64' | 'jwt' | 'hash' | 'diff' | 'url' | 'timestamp' | 'html'
export type TransformOptions = { mode?: string; second?: string; algorithm?: 'SHA-1' | 'SHA-256' | 'SHA-512'; subtle?: SubtleCrypto }
const MAX_INPUT = 200000

export function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192))
  return btoa(binary)
}
export function decodeBase64(value: string): string {
  const clean = value.replace(/\s/g, '')
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(?:==)?|[A-Za-z0-9+/]{3}=?|)?$/.test(clean)) throw new Error('Invalid Base64 input.')
  const binary = atob(clean)
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))
}
function decodeJwtPart(part: string) {
  return JSON.parse(decodeBase64(part.replace(/-/g, '+').replace(/_/g, '/')))
}
export function inspectJwt(value: string) {
  const parts = value.trim().split('.')
  if (parts.length !== 3 || !parts[0] || !parts[1]) throw new Error('Enter a JWT with header.payload.signature segments.')
  const header = decodeJwtPart(parts[0]); const payload = decodeJwtPart(parts[1])
  if (!header || typeof header !== 'object' || Array.isArray(header) || !payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('JWT header and payload must be JSON objects.')
  return { warning: 'Decoded only. The signature and claims have NOT been verified.', header, payload }
}
export function lineDiff(before: string, after: string): string {
  if (before === after) return 'The texts are identical.'
  const a = before.replace(/\r\n/g, '\n').split('\n'); const b = after.replace(/\r\n/g, '\n').split('\n')
  if (a.length > 700 || b.length > 700) throw new Error('Compare up to 700 lines per input.')
  const table = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
  let i = 0; let j = 0; const output: string[] = []
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { output.push('  ' + a[i]); i++; j++ }
    else if (i < a.length && (j === b.length || table[i + 1][j] >= table[i][j + 1])) output.push('- ' + a[i++])
    else output.push('+ ' + b[j++])
  }
  return output.join('\n')
}
export async function transform(tool: LocalTool, input: string, options: TransformOptions = {}): Promise<string> {
  if (input.length > MAX_INPUT || (options.second?.length || 0) > MAX_INPUT) throw new Error('Use up to 200,000 characters per input.')
  switch (tool) {
    case 'json': return JSON.stringify(JSON.parse(input), null, options.mode === 'minify' ? undefined : 2)
    case 'base64': return options.mode === 'decode' ? decodeBase64(input) : encodeBase64(input)
    case 'jwt': return JSON.stringify(inspectJwt(input), null, 2)
    case 'hash': {
      const subtle = options.subtle || globalThis.crypto?.subtle
      if (!subtle) throw new Error('Cryptographic hashing is unavailable in this environment.')
      const bytes = await subtle.digest(options.algorithm || 'SHA-256', new TextEncoder().encode(input))
      return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
    }
    case 'diff': return lineDiff(input, options.second || '')
    case 'url': return options.mode === 'decode' ? decodeURIComponent(input) : encodeURIComponent(input)
    case 'html': {
      const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
      if (options.mode !== 'decode') return input.replace(/[&<>"']/g, (character) => entities[character])
      return input.replace(/&(amp|lt|gt|quot|#39);/g, (entity) => Object.keys(entities).find((key) => entities[key] === entity) || entity)
    }
    case 'timestamp': {
      const trimmed = input.trim()
      if (!trimmed) throw new Error('Enter a Unix timestamp or an ISO date with timezone.')
      let date: Date
      if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) date = new Date(Number(trimmed) * (options.mode === 'milliseconds' ? 1 : 1000))
      else {
        if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed)) throw new Error('Include a timezone, for example 2026-11-18T12:00:00+07:00.')
        date = new Date(trimmed)
      }
      if (!Number.isFinite(date.getTime())) throw new Error('Invalid timestamp or date.')
      return JSON.stringify({ iso: date.toISOString(), unixSeconds: Math.floor(date.getTime() / 1000), unixMilliseconds: date.getTime(), local: date.toString() }, null, 2)
    }
  }
}
