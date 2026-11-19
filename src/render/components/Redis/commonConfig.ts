export const redisCommonFields = [
  { name: 'port', defaultValue: '6379', label: 'Port', help: 'common.label.port' },
  { name: 'timeout', defaultValue: '0', label: 'Idle timeout (seconds)', help: 'redis.timeout' },
  {
    name: 'maxclients',
    defaultValue: '10000',
    label: 'Maximum clients',
    help: 'mysql.max_connections'
  },
  { name: 'databases', defaultValue: '16', label: 'Number of databases', help: 'redis.databases' },
  { name: 'requirepass', defaultValue: '', label: 'Password', help: 'redis.requirepass' },
  { name: 'maxmemory', defaultValue: '0', label: 'Maximum memory', help: 'redis.maxmemory' }
] as const

export type RedisCommonField = (typeof redisCommonFields)[number]

function activeLines(content: string, field: RedisCommonField) {
  const lines = content.split(/(\r\n|\n|\r)/)
  const pattern = new RegExp(`^([ \t]*)${field.name}[ \t]+(.+?)\\s*$`, 'i')
  const matches: { index: number; indent: string; value: string }[] = []
  for (let index = 0; index < lines.length; index += 2) {
    const match = pattern.exec(lines[index])
    if (match) matches.push({ index, indent: match[1], value: match[2] })
  }
  return { lines, matches }
}

export function readRedisCommonField(content: string, field: RedisCommonField) {
  const match = activeLines(content, field).matches.at(-1)
  return { enabled: Boolean(match), value: match?.value ?? field.defaultValue }
}

export function updateRedisCommonField(
  content: string,
  field: RedisCommonField,
  enabled: boolean,
  value: string
) {
  const { lines, matches } = activeLines(content, field)
  if (!enabled) {
    for (const { index, indent } of matches) {
      lines[index] = `${indent}# ${lines[index].slice(indent.length)}`
    }
    return lines.join('')
  }

  const argument = value.trim() || (field.name === 'requirepass' ? '""' : field.defaultValue)
  const entry = `${field.name} ${argument}`
  const last = matches.at(-1)
  if (last) {
    lines[last.index] = last.indent + entry
    return lines.join('')
  }
  const newline = lines[1] ?? '\n'
  return content + (content && lines.at(-1) ? newline : '') + entry + newline
}
