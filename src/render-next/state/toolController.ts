import type { LocalTool } from '../tools/transforms'
export type ToolCategory = 'Code' | 'Network' | 'Security' | 'Converter' | 'Files'
export type ToolItem = {
  id:
    | LocalTool
    | 'playground'
    | 'request-time'
    | 'websocket'
    | 'terminal'
    | 'bom-clean'
    | 'ssl-maker'
    | 'process'
    | 'environment'
    | 'markdown'
    | 'git-cheatsheet'
    | 'http-status'
    | 'url-parse'
    | 'mime-types'
    | 'regex-cheatsheet'
    | 'file-info'
    | 'keycode'
    | 'qrcode'
    | 'base64-file'
    | 'token'
    | 'regex-tester'
    | 'encryption'
    | 'chmod'
    | 'wifi-qrcode'
    | 'rsa'
    | 'image-compress'
    | 'code-library'
    | 'php-obfuscator'
    | 'mysql-code'
    | 'cron-parser'
    | 'capturer'
    | 'site-sucker'
  name: string
  description: string
  category: ToolCategory
  glyph: string
  available: boolean
}
const tools: ToolItem[] = [
  { id: 'capturer', name: 'Screen capturer', description: 'Capture windows and regions with naming rules.', category: 'Files', glyph: 'CAP', available: true },
  { id: 'site-sucker', name: 'Site sucker', description: 'Mirror a site with bounded pages and media sizes.', category: 'Network', glyph: 'WEB', available: true },
  {
    id: 'json',
    name: 'JSON formatter',
    description: 'Format, minify and validate JSON locally.',
    category: 'Code',
    glyph: '{}',
    available: true
  },
  {
    id: 'base64',
    name: 'Base64 converter',
    description: 'Encode and decode Unicode text.',
    category: 'Converter',
    glyph: '64',
    available: true
  },
  {
    id: 'jwt',
    name: 'JWT inspector',
    description: 'Decode header and claims. Signature is not verified.',
    category: 'Security',
    glyph: 'JWT',
    available: true
  },
  {
    id: 'hash',
    name: 'Hash text',
    description: 'Compute SHA-1, SHA-256 and SHA-512.',
    category: 'Security',
    glyph: '#',
    available: true
  },
  {
    id: 'diff',
    name: 'Diff compare',
    description: 'Compare two texts line by line.',
    category: 'Code',
    glyph: '±',
    available: true
  },
  {
    id: 'url',
    name: 'URL encode',
    description: 'Encode or decode a URI component.',
    category: 'Converter',
    glyph: '%',
    available: true
  },
  {
    id: 'timestamp',
    name: 'Timestamp',
    description: 'Convert Unix timestamps and ISO dates.',
    category: 'Converter',
    glyph: '◷',
    available: true
  },
  {
    id: 'html',
    name: 'Escape HTML',
    description: 'Escape or unescape HTML text characters.',
    category: 'Converter',
    glyph: '</>',
    available: true
  },
  {
    id: 'playground',
    name: 'Code playground',
    description: 'Run snippets with an installed local runtime.',
    category: 'Code',
    glyph: '⌘',
    available: true
  },
  {
    id: 'request-time',
    name: 'Request timing',
    description: 'Measure DNS, connection, TLS and response timing.',
    category: 'Network',
    glyph: '↗',
    available: true
  },
  {
    id: 'websocket',
    name: 'WebSocket / SSE',
    description: 'Connect to realtime WebSocket and SSE endpoints.',
    category: 'Network',
    glyph: '◌',
    available: true
  },
  {
    id: 'terminal',
    name: 'Integrated terminal',
    description: 'Run commands in a managed PTY session.',
    category: 'Code',
    glyph: '>_',
    available: true
  },
  {
    id: 'bom-clean',
    name: 'UTF-8 BOM cleaner',
    description: 'Find and remove UTF-8 BOM markers from a folder.',
    category: 'Files',
    glyph: 'BOM',
    available: true
  },
  {
    id: 'ssl-maker',
    name: 'Local SSL maker',
    description: 'Generate a local CA and certificates for development domains.',
    category: 'Security',
    glyph: 'SSL',
    available: true
  },
  {
    id: 'process',
    name: 'Process control',
    description: 'Find and stop processes by port or process name.',
    category: 'Code',
    glyph: 'PID',
    available: true
  },
  {
    id: 'environment',
    name: 'System environment files',
    description: 'Inspect and edit shell environment files safely.',
    category: 'Files',
    glyph: 'ENV',
    available: true
  },
  {
    id: 'markdown',
    name: 'Markdown preview',
    description: 'Edit Markdown and preview rendered documentation.',
    category: 'Code',
    glyph: 'MD',
    available: true
  },
  {
    id: 'git-cheatsheet',
    name: 'Git cheatsheet',
    description: 'Browse common Git commands and workflows.',
    category: 'Code',
    glyph: 'git',
    available: true
  },
  {
    id: 'http-status',
    name: 'HTTP status codes',
    description: 'Search HTTP response codes and meanings.',
    category: 'Network',
    glyph: '404',
    available: true
  },
  {
    id: 'url-parse',
    name: 'URL parser',
    description: 'Inspect URL parts and query parameters.',
    category: 'Network',
    glyph: 'URL',
    available: true
  },
  {
    id: 'mime-types',
    name: 'MIME types',
    description: 'Look up MIME types by extension and extensions by MIME.',
    category: 'Network',
    glyph: 'MIME',
    available: true
  },
  {
    id: 'regex-cheatsheet',
    name: 'Regex cheatsheet',
    description: 'Quick reference for regular expression syntax.',
    category: 'Code',
    glyph: '.*',
    available: true
  },
  {
    id: 'file-info',
    name: 'File information',
    description: 'Inspect timestamps, size and cryptographic hashes.',
    category: 'Files',
    glyph: 'Σ',
    available: true
  },
  {
    id: 'keycode',
    name: 'Keyboard inspector',
    description: 'Press a key to inspect its browser event properties.',
    category: 'Code',
    glyph: '⌨',
    available: true
  },
  {
    id: 'qrcode',
    name: 'QR code generator',
    description: 'Generate a QR image from text or a URL.',
    category: 'Converter',
    glyph: 'QR',
    available: true
  },
  {
    id: 'base64-file',
    name: 'Base64 file converter',
    description: 'Convert local files to Base64 or save Base64 as a file.',
    category: 'Converter',
    glyph: 'B64',
    available: true
  },
  {
    id: 'token',
    name: 'Token generator',
    description: 'Generate secure random tokens with custom character sets.',
    category: 'Security',
    glyph: 'KEY',
    available: true
  },
  {
    id: 'regex-tester',
    name: 'Regex tester',
    description: 'Test a regular expression against sample text.',
    category: 'Code',
    glyph: 'R×',
    available: true
  },
  {
    id: 'encryption',
    name: 'Text encryption',
    description: 'Encrypt and decrypt text locally with a secret key.',
    category: 'Security',
    glyph: 'AES',
    available: true
  },
  {
    id: 'chmod',
    name: 'Chmod calculator',
    description: 'Build octal and symbolic Unix file permissions.',
    category: 'Files',
    glyph: '755',
    available: true
  },
  {
    id: 'wifi-qrcode',
    name: 'Wi-Fi QR code',
    description: 'Generate a QR code for joining a wireless network.',
    category: 'Network',
    glyph: 'WiFi',
    available: true
  },
  {
    id: 'rsa',
    name: 'RSA key generator',
    description: 'Generate a public/private RSA key pair locally.',
    category: 'Security',
    glyph: 'RSA',
    available: true
  },
  {
    id: 'image-compress',
    name: 'Image compressor',
    description: 'Batch process local images with the existing Sharp pipeline.',
    category: 'Files',
    glyph: 'IMG',
    available: true
  },
  {
    id: 'code-library',
    name: 'Code library',
    description: 'Save, search and organize reusable code snippets locally.',
    category: 'Code',
    glyph: 'LIB',
    available: true
  },
  {
    id: 'php-obfuscator',
    name: 'PHP obfuscator',
    description: 'Obfuscate PHP files or folders with an installed PHP runtime.',
    category: 'Security',
    glyph: 'PHP',
    available: true
  },
  {
    id: 'mysql-code',
    name: 'MySQL code maker',
    description: 'Connect to a MySQL server and inspect available databases.',
    category: 'Code',
    glyph: 'SQL',
    available: true
  },
  {
    id: 'cron-parser',
    name: 'Cron expression parser',
    description: 'Generate schedules or inspect upcoming run times.',
    category: 'Code',
    glyph: 'CRON',
    available: true
  }
]
export const toolController = {
  tools,
  categories: ['All', 'Code', 'Network', 'Security', 'Converter', 'Files']
}
