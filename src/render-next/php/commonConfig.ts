type PhpField = {
  name: string
  section: string
  fallback: string
  kind?: 'path' | 'certificate'
  options?: readonly string[]
}

const switchOptions = ['On', 'Off'] as const
const fields: readonly PhpField[] = [
  { name: 'log_errors', section: 'PHP', fallback: 'On', options: switchOptions },
  { name: 'error_log', section: 'PHP', fallback: '', kind: 'path' },
  { name: 'display_errors', section: 'PHP', fallback: 'On', options: switchOptions },
  { name: 'short_open_tag', section: 'PHP', fallback: 'On', options: switchOptions },
  { name: 'file_uploads', section: 'PHP', fallback: 'On', options: switchOptions },
  { name: 'cgi.fix_pathinfo', section: 'PHP-CGI', fallback: '1', options: ['0', '1'] },
  { name: 'max_execution_time', section: 'PHP', fallback: '300' },
  { name: 'max_input_time', section: 'PHP', fallback: '60' },
  { name: 'memory_limit', section: 'PHP', fallback: '128M' },
  { name: 'post_max_size', section: 'PHP', fallback: '20M' },
  { name: 'upload_max_filesize', section: 'PHP', fallback: '20M' },
  { name: 'max_file_uploads', section: 'PHP', fallback: '20' },
  { name: 'default_socket_timeout', section: 'PHP', fallback: '60' },
  { name: 'error_reporting', section: 'PHP', fallback: 'E_ALL & ~E_NOTICE' },
  { name: 'date.timezone', section: 'PHP', fallback: 'PRC' },
  { name: 'curl.cainfo', section: 'curl', fallback: '', kind: 'certificate' },
  { name: 'openssl.cafile', section: 'openssl', fallback: '', kind: 'certificate' }
]

type Assignment = {
  offset: number
  length: number
  indent: string
  commented: boolean
  key: string
  separator: string
  value: string
  tail: string
}

type Quote = '"' | "'" | undefined

function scanValue(value: string, quote?: Quote) {
  for (let index = 0; index < value.length; index++) {
    const char = value[index]
    if (quote === '"' && char === '\\' && /["\\$]/.test(value[index + 1] ?? '')) {
      index++
    } else if (quote) {
      if (char === quote) quote = undefined
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === ';') {
      return { end: index, quote }
    }
  }
  return { end: value.length, quote }
}

function scanIni(content: string) {
  const segments = content.split(/(\r\n|\n|\r)/)
  const eol = segments[1] || '\n'
  const assignments: Assignment[] = []
  const multiline = new Set<string>()
  const sections = new Map<string, number>()
  let section: string | undefined
  let quote: Quote
  // Preserve a BOM and keep global edits ahead of the first scoped section.
  const start = content.startsWith('\ufeff') ? 1 : 0
  let offset = start
  for (let index = 0; index < segments.length; index += 2) {
    const line = index === 0 ? segments[index].slice(start) : segments[index]
    const lineOffset = offset
    offset += line.length + (segments[index + 1]?.length ?? 0)
    if (quote) {
      quote = scanValue(line, quote).quote
      continue
    }
    const header = /^\s*\[([^\]]+)\]\s*(?:;.*)?$/.exec(line)
    if (header) {
      if (section) sections.set(section, lineOffset)
      section = header[1].trim().toLowerCase()
      // PHP keeps writing to the scoped hash after ordinary headers.
      if (/^(host|path)/.test(section)) {
        return { assignments, multiline, sections, eol, insertAt: lineOffset }
      }
      continue
    }
    const match = /^([\t ]*)(;[\t ]*)?([\w.]+)([\t ]*=[\t ]*)(.*)$/.exec(line)
    if (!match) continue
    const [, indent, comment, key, separator, raw] = match
    const scanned = scanValue(raw)
    if (scanned.quote && !comment) {
      multiline.add(key)
      quote = scanned.quote
      continue
    }
    const value = raw.slice(0, scanned.end).trimEnd()
    assignments.push({
      offset: lineOffset,
      length: line.length,
      indent,
      commented: Boolean(comment),
      key,
      separator,
      value,
      tail: raw.slice(value.length)
    })
  }
  if (section) sections.set(section, content.length)
  return { assignments, multiline, sections, eol, insertAt: content.length }
}

function readPath(value: string) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\(["\\$])/g, '$1')
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1)
  return value
}

export function readPhpSettings(content: string, certificate: string) {
  const { assignments, multiline } = scanIni(content)
  return fields.map((field) => {
    const active = assignments.findLast((row) => row.key === field.name && !row.commented)
    const value = active?.value ?? (field.kind === 'certificate' ? certificate : field.fallback)
    return {
      field,
      value: field.kind ? readPath(value) : value,
      enabled: Boolean(active) || multiline.has(field.name),
      rawOnly: multiline.has(field.name)
    }
  })
}

export function updatePhpField(content: string, field: PhpField, enabled: boolean, value: string) {
  const { assignments, multiline, sections, eol, insertAt } = scanIni(content)
  if (multiline.has(field.name) || /[\r\n]/.test(value)) return content
  const matches = assignments.filter((row) => row.key === field.name)
  const active = matches.filter((row) => !row.commented)
  if (!enabled) {
    // Comment every active copy so an earlier definition does not become effective.
    for (const { offset, indent } of active.reverse()) {
      const at = offset + indent.length
      content = content.slice(0, at) + ';' + content.slice(at)
    }
    return content
  }

  const input = value.trim()
  const serialized = field.kind ? '"' + input.replace(/["\\$]/g, '\\$&') + '"' : input
  const entry = active.at(-1) ?? matches.at(-1)
  if (entry) {
    if (!entry.commented && (field.kind ? readPath(entry.value) : entry.value) === input)
      return content
    const assignment = entry.indent + entry.key + entry.separator + serialized + entry.tail
    return content.slice(0, entry.offset) + assignment + content.slice(entry.offset + entry.length)
  }

  const sectionEnd = sections.get(field.section.toLowerCase())
  const offset = sectionEnd ?? insertAt
  const before = content.slice(0, offset)
  const after = content.slice(offset)
  const leading = before.replace(/^\ufeff/, '') && !/[\r\n]$/.test(before) ? eol : ''
  const header = sectionEnd === undefined ? '[' + field.section + ']' + eol : ''
  const trailing = after || !before || /[\r\n]$/.test(before) ? eol : ''
  return before + leading + header + field.name + ' = ' + serialized + trailing + after
}
