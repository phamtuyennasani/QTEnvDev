import type { LocalTool } from '../tools/transforms'
export type ToolCategory = 'Code' | 'Network' | 'Security' | 'Converter' | 'Files'
export type ToolItem = { id: LocalTool | 'playground' | 'request-time' | 'websocket' | 'terminal' | 'bom-clean' | 'ssl-maker' | 'process' | 'environment' | 'markdown' | 'git-cheatsheet' | 'http-status' | 'url-parse' | 'mime-types' | 'regex-cheatsheet' | 'file-info' | 'keycode'; name: string; description: string; category: ToolCategory; glyph: string; available: boolean }
const tools: ToolItem[] = [
  { id: 'json', name: 'JSON formatter', description: 'Format, minify and validate JSON locally.', category: 'Code', glyph: '{}', available: true },
  { id: 'base64', name: 'Base64 converter', description: 'Encode and decode Unicode text.', category: 'Converter', glyph: '64', available: true },
  { id: 'jwt', name: 'JWT inspector', description: 'Decode header and claims. Signature is not verified.', category: 'Security', glyph: 'JWT', available: true },
  { id: 'hash', name: 'Hash text', description: 'Compute SHA-1, SHA-256 and SHA-512.', category: 'Security', glyph: '#', available: true },
  { id: 'diff', name: 'Diff compare', description: 'Compare two texts line by line.', category: 'Code', glyph: '±', available: true },
  { id: 'url', name: 'URL encode', description: 'Encode or decode a URI component.', category: 'Converter', glyph: '%', available: true },
  { id: 'timestamp', name: 'Timestamp', description: 'Convert Unix timestamps and ISO dates.', category: 'Converter', glyph: '◷', available: true },
  { id: 'html', name: 'Escape HTML', description: 'Escape or unescape HTML text characters.', category: 'Converter', glyph: '</>', available: true },
  { id: 'playground', name: 'Code playground', description: 'Run snippets with an installed local runtime.', category: 'Code', glyph: '⌘', available: true },
  { id: 'request-time', name: 'Request timing', description: 'Measure DNS, connection, TLS and response timing.', category: 'Network', glyph: '↗', available: true },
  { id: 'websocket', name: 'WebSocket / SSE', description: 'Connect to realtime WebSocket and SSE endpoints.', category: 'Network', glyph: '◌', available: true },
  { id: 'terminal', name: 'Integrated terminal', description: 'Run commands in a managed PTY session.', category: 'Code', glyph: '>_', available: true },
  { id: 'bom-clean', name: 'UTF-8 BOM cleaner', description: 'Find and remove UTF-8 BOM markers from a folder.', category: 'Files', glyph: 'BOM', available: true }
  ,{ id: 'ssl-maker', name: 'Local SSL maker', description: 'Generate a local CA and certificates for development domains.', category: 'Security', glyph: 'SSL', available: true }
  ,{ id: 'process', name: 'Process control', description: 'Find and stop processes by port or process name.', category: 'Code', glyph: 'PID', available: true }
  ,{ id: 'environment', name: 'System environment files', description: 'Inspect and edit shell environment files safely.', category: 'Files', glyph: 'ENV', available: true }
  ,{ id: 'markdown', name: 'Markdown preview', description: 'Edit Markdown and preview rendered documentation.', category: 'Code', glyph: 'MD', available: true }
  ,{ id: 'git-cheatsheet', name: 'Git cheatsheet', description: 'Browse common Git commands and workflows.', category: 'Code', glyph: 'git', available: true }
  ,{ id: 'http-status', name: 'HTTP status codes', description: 'Search HTTP response codes and meanings.', category: 'Network', glyph: '404', available: true }
  ,{ id: 'url-parse', name: 'URL parser', description: 'Inspect URL parts and query parameters.', category: 'Network', glyph: 'URL', available: true }
  ,{ id: 'mime-types', name: 'MIME types', description: 'Look up MIME types by extension and extensions by MIME.', category: 'Network', glyph: 'MIME', available: true }
  ,{ id: 'regex-cheatsheet', name: 'Regex cheatsheet', description: 'Quick reference for regular expression syntax.', category: 'Code', glyph: '.*', available: true }
  ,{ id: 'file-info', name: 'File information', description: 'Inspect timestamps, size and cryptographic hashes.', category: 'Files', glyph: 'Σ', available: true }
  ,{ id: 'keycode', name: 'Keyboard inspector', description: 'Press a key to inspect its browser event properties.', category: 'Code', glyph: '⌨', available: true }
]
export const toolController = { tools, categories: ['All', 'Code', 'Network', 'Security', 'Converter', 'Files'] }
