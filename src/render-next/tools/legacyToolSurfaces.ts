export const legacyToolSurfaces = {
  json: { title: 'Structured data converter', load: () => import('@/components/Tools/Json/Index.vue') },
  jwt: { title: 'JWT encoder / decoder', load: () => import('@/components/Tools/JWT/Index.vue') },
  'code-library': { title: 'Code library', load: () => import('@/components/Tools/CodeLibrary/index.vue') },
  'regex-tester': { title: 'Regex tester', load: () => import('@/components/Tools/RegexTester/index.vue') },
  diff: { title: 'Diff compare', load: () => import('@/components/Tools/DiffCompare/Index.vue') },
  markdown: { title: 'Markdown preview', load: () => import('@/components/Tools/MarkdownPreview/index.vue') },
  qrcode: { title: 'QR code generator', load: () => import('@/components/Tools/QRCodeGenerator/index.vue') },
  'wifi-qrcode': { title: 'Wi-Fi QR code generator', load: () => import('@/components/Tools/WifiQRCodeGenerator/index.vue') },
  'file-info': { title: 'File information', load: () => import('@/components/Tools/FileInfo/Index.vue') },
  keycode: { title: 'Keyboard inspector', load: () => import('@/components/Tools/KeycodeInfo/index.vue') },
  'cron-parser': { title: 'Cron expression parser', load: () => import('@/components/Tools/CronParser/Index.vue') },
  timestamp: { title: 'Timestamp converter', load: () => import('@/components/Tools/Timestamp/Index.vue') },
  environment: { title: 'System environment', load: () => import('@/components/Tools/SystenEnv/main.vue') },
  'ssl-maker': { title: 'Local SSL maker', load: () => import('@/components/Tools/SSLMake/Index.vue') },
  'bom-clean': { title: 'UTF-8 BOM cleaner', load: () => import('@/components/Tools/BomClean/Index.vue') },
  'php-obfuscator': { title: 'PHP obfuscator', load: () => import('@/components/Tools/PhpObfuscator/Index.vue') },
  playground: { title: 'Code playground', load: () => import('@/components/Tools/CodePlayground/index.vue') },
  websocket: { title: 'WebSocket / SSE', load: () => import('@/components/Tools/WebSocketSSE/Index.vue') }
} as const
export type LegacyToolSurface = keyof typeof legacyToolSurfaces
export const isLegacyToolSurface = (value: string): value is LegacyToolSurface => Object.hasOwn(legacyToolSurfaces, value)
