export type SqlEngine = 'mysql' | 'mariadb'

export const sqlCommonFields = [
  { name: 'port', label: 'Port', defaultValue: '3306' },
  { name: 'socket', label: 'Socket', defaultValue: '/tmp/mysql.sock' },
  { name: 'key_buffer_size', label: 'Key buffer size', defaultValue: '64M' },
  { name: 'query_cache_size', label: 'Query cache size', defaultValue: '32M' },
  { name: 'tmp_table_size', label: 'Temporary table size', defaultValue: '64M' },
  { name: 'innodb_buffer_pool_size', label: 'InnoDB buffer pool size', defaultValue: '256M' },
  { name: 'innodb_log_buffer_size', label: 'InnoDB log buffer size', defaultValue: '32M' },
  { name: 'sort_buffer_size', label: 'Sort buffer size', defaultValue: '1M' },
  { name: 'read_buffer_size', label: 'Read buffer size', defaultValue: '1M' },
  { name: 'read_rnd_buffer_size', label: 'Random read buffer size', defaultValue: '256K' },
  { name: 'thread_cache_size', label: 'Thread cache size', defaultValue: '32' },
  { name: 'table_open_cache', label: 'Open table cache', defaultValue: '256' },
  { name: 'max_connections', label: 'Maximum connections', defaultValue: '500' }
] as const

export type SqlCommonField = (typeof sqlCommonFields)[number]

export function visibleSqlFields(engine: SqlEngine, version: string, windows: boolean) {
  return sqlCommonFields.filter((field) => {
    if (field.name === 'socket') return !windows
    if (field.name === 'query_cache_size') return engine === 'mariadb' || version.startsWith('5.')
    return true
  })
}

function findSetting(content: string, engine: SqlEngine, name: SqlCommonField['name']) {
  const lines = content.split(/(\r\n|\n|\r)/)
  const assignment = new RegExp(`^(\\s*${name.replaceAll('_', '[-_]')}\\s*=\\s*)(.*)$`, 'i')
  const matches: Array<{ index: number; prefix: string; value: string; suffix: string }> = []
  const sections = new Map<string, number>()
  let server = false
  for (let index = 0; index < lines.length; index += 2) {
    const line = lines[index]
    const section = /^\s*\[([^\]]+)\]/.exec(line)?.[1]?.trim().toLowerCase()
    if (section) {
      server = section === 'mysqld' || (engine === 'mariadb' && section === 'mariadbd')
      if (server) sections.set(section, index)
      continue
    }
    if (!server) continue
    const match = assignment.exec(line)
    if (!match) continue
    const [, prefix, raw] = match
    const value = /^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|.*?)(\s+(?:#|;).*|\s*)$/.exec(raw)
    matches.push({ index, prefix, value: value?.[1] ?? raw, suffix: value?.[2] ?? '' })
  }
  const section =
    (engine === 'mariadb' ? sections.get('mariadbd') : undefined) ?? sections.get('mysqld')
  return { lines, matches, section }
}

export function readSqlField(content: string, engine: SqlEngine, field: SqlCommonField) {
  const match = findSetting(content, engine, field.name).matches.at(-1)
  return { enabled: Boolean(match), value: match?.value ?? field.defaultValue }
}

export function updateSqlField(
  content: string,
  engine: SqlEngine,
  field: SqlCommonField,
  enabled: boolean,
  value: string
) {
  const { lines, matches, section } = findSetting(content, engine, field.name)
  if (!enabled) {
    for (const { index } of matches) lines[index] = lines[index].replace(/^(\s*)/, '$1# ')
    return lines.join('')
  }
  const replacement = value.trim() || field.defaultValue
  // Individual controls edit one value. Multiline changes belong in Raw file.
  if (/[\r\n]/.test(replacement)) return content
  const last = matches.at(-1)
  if (last) {
    lines[last.index] = last.prefix + replacement + last.suffix
    return lines.join('')
  }
  const newline = lines[1] ?? '\n'
  const entry = `${field.name} = ${replacement}`
  if (section !== undefined) {
    lines.splice(section + 1, 0, newline, entry)
    return lines.join('')
  }
  const header = engine === 'mariadb' ? '[mariadbd]' : '[mysqld]'
  return content + (content && lines.at(-1) ? newline : '') + header + newline + entry + newline
}
