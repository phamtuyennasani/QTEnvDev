import type { LocalTool } from '../tools/transforms'
export type ToolCategory = 'Code' | 'Network' | 'Security' | 'Converter'
export type ToolItem = { id: LocalTool | 'playground' | 'request-time' | 'websocket' | 'terminal'; name: string; description: string; category: ToolCategory; glyph: string; available: boolean }
const tools: ToolItem[] = [
  { id: 'json', name: 'JSON formatter', description: 'Format, minify and validate JSON locally.', category: 'Code', glyph: '{}', available: true },
  { id: 'base64', name: 'Base64 converter', description: 'Encode and decode Unicode text.', category: 'Converter', glyph: '64', available: true },
  { id: 'jwt', name: 'JWT inspector', description: 'Decode header and claims. Signature is not verified.', category: 'Security', glyph: 'JWT', available: true },
  { id: 'hash', name: 'Hash text', description: 'Compute SHA-1, SHA-256 and SHA-512.', category: 'Security', glyph: '#', available: true },
  { id: 'diff', name: 'Diff compare', description: 'Compare two texts line by line.', category: 'Code', glyph: '±', available: true },
  { id: 'url', name: 'URL encode', description: 'Encode or decode a URI component.', category: 'Converter', glyph: '%', available: true },
  { id: 'timestamp', name: 'Timestamp', description: 'Convert Unix timestamps and ISO dates.', category: 'Converter', glyph: '◷', available: true },
  { id: 'html', name: 'Escape HTML', description: 'Escape or unescape HTML text characters.', category: 'Converter', glyph: '</>', available: true },
  { id: 'playground', name: 'Code playground', description: 'Dedicated execution panel pending migration.', category: 'Code', glyph: '⌘', available: false },
  { id: 'request-time', name: 'Request timing', description: 'Network timing panel pending migration.', category: 'Network', glyph: '↗', available: false },
  { id: 'websocket', name: 'WebSocket / SSE', description: 'Realtime connection panel pending migration.', category: 'Network', glyph: '◌', available: false },
  { id: 'terminal', name: 'Integrated terminal', description: 'Run commands in a managed PTY session.', category: 'Code', glyph: '>_', available: true }
]
export const toolController = { tools, categories: ['All', 'Code', 'Network', 'Security', 'Converter'] }
