export type WebServer = 'apache' | 'nginx'

type Directive = { name: string; fallback: string; options?: string[] }

export const directives: Record<WebServer, Directive[]> = {
  apache: [
    { name: 'Timeout', fallback: '60' },
    { name: 'KeepAlive', fallback: 'Off', options: ['On', 'Off'] },
    { name: 'KeepAliveTimeout', fallback: '15' },
    { name: 'MaxKeepAliveRequests', fallback: '1000' },
    { name: 'LimitRequestBody', fallback: '0' }
  ],
  nginx: [
    { name: 'keepalive_timeout', fallback: '60' },
    { name: 'gzip', fallback: 'off', options: ['on', 'off'] },
    { name: 'gzip_min_length', fallback: '1k' },
    { name: 'gzip_comp_level', fallback: '2' },
    { name: 'client_max_body_size', fallback: '50m' },
    { name: 'server_names_hash_bucket_size', fallback: '128' },
    { name: 'server_names_hash_max_size', fallback: '512' },
    { name: 'client_header_buffer_size', fallback: '32k' },
    { name: 'client_body_buffer_size', fallback: '32k' }
  ]
}

const tokenPattern = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\\.|#.*|[{}]/g

function locateScope(lines: string[], engine: WebServer) {
  const eligible = new Set<number>()
  let depth = 0
  let httpCount = 0
  let inHttp = false
  let insertAt = engine === 'apache' ? 0 : undefined
  for (const [index, line] of lines.entries()) {
    if (engine === 'apache') {
      if (/^\s*<\//.test(line)) depth--
      else if (/^\s*<[^/]/.test(line)) depth++
      else if (depth === 0) eligible.add(index)
    } else {
      if (inHttp && depth === 1) eligible.add(index)
      if (depth === 0 && /^\s*http\s*\{\s*(?:#.*)?$/.test(line)) {
        inHttp = true
        httpCount++
        insertAt = index + 1
      }
      for (const token of line.match(tokenPattern) ?? []) {
        if (token === '{') depth++
        if (token === '}') depth--
      }
      if (depth === 0) inHttp = false
    }
    if (depth < 0) return
  }
  if (depth !== 0 || (engine === 'nginx' && httpCount !== 1) || insertAt === undefined) return
  return { eligible, insertAt }
}

function scan(content: string, engine: WebServer) {
  const newline = content.includes('\r\n') ? '\r\n' : '\n'
  const lines = content.split(/\r?\n/)
  const scope = locateScope(lines, engine)
  if (!scope) return
  return { ...scope, newline, lines }
}

export function getWebServerSettings(content: string, engine: WebServer) {
  const parsed = scan(content, engine)
  if (!parsed) return
  return directives[engine].map((field) => {
    const separator = engine === 'nginx' ? ';' : ''
    const valuePattern = engine === 'nginx' ? '[^;#]*?' : '[^#]*?'
    const pattern = new RegExp(
      '^([ \\t]*)(#[ \\t]*)?' + field.name + '[ \\t]+(' + valuePattern +
        ')' + separator + '\\s*(#.*)?$',
      engine === 'apache' ? 'i' : ''
    )
    const indexes: number[] = []
    const comments: number[] = []
    const startsWith = new RegExp(
      '^[ \\t]*' + field.name + '\\b',
      engine === 'apache' ? 'i' : ''
    )
    let unsupported = false
    for (const index of parsed.eligible) {
      const line = parsed.lines[index]
      const match = pattern.exec(line)
      if (!match || line.endsWith('\\')) {
        if (startsWith.test(line)) unsupported = true
        continue
      }
      ;(match[2] ? comments : indexes).push(index)
    }
    const index = indexes[0] ?? comments[0]
    const match = index === undefined ? undefined : pattern.exec(parsed.lines[index])
    return {
      ...field,
      ambiguous: unsupported || indexes.length > 1,
      enabled: indexes.length > 0,
      value: match?.[3].trim() || field.fallback,
      index,
      indent: match?.[1] ?? (engine === 'nginx' ? '    ' : ''),
      comment: match?.[4]
    }
  })
}

export function updateWebServerSetting(
  content: string,
  engine: WebServer,
  name: string,
  enabled: boolean,
  value: string
) {
  if (/[\r\n#;{}]/.test(value)) return content
  const parsed = scan(content, engine)
  const setting = getWebServerSettings(content, engine)?.find((entry) => entry.name === name)
  if (!parsed || !setting || setting.ambiguous || (!enabled && !setting.enabled)) return content
  const suffix = engine === 'nginx' ? ';' : ''
  const comment = setting.comment ? ' ' + setting.comment : ''
  const line = setting.indent + (enabled ? '' : '# ') + name + ' ' + value + suffix + comment
  if (setting.index === undefined) parsed.lines.splice(parsed.insertAt, 0, line)
  else parsed.lines[setting.index] = line
  return parsed.lines.join(parsed.newline)
}
