import type { CommonSetItem } from '@/components/Conf/setup'
import { parse } from 'toml'

type Toml = Record<string, unknown>

function readToml(content: string): Toml | undefined {
  try {
    return parse(content, { bigint: true, maxDepth: 100 })
  } catch {
    return undefined
  }
}

function readSetting(content: string, document: Toml | undefined, name: string) {
  if (!document || !/^[a-z_]+$/.test(name)) return { ambiguous: true }
  if (!Object.hasOwn(document, name)) return { ambiguous: false }

  const key = [name, '"' + name + '"', "'" + name + "'"].join('|')
  const assignment = new RegExp('^([ \\t]*(?:' + key + ')[ \\t]*=[ \\t]*)(.*)$', 'gm')
  const value = document[name]
  if (!['string', 'number', 'bigint', 'boolean'].includes(typeof value)) {
    return { ambiguous: true }
  }
  for (const match of content.matchAll(assignment)) {
    const rhs = /^(?:"(?:[^"\\]|\\.)*"|'[^']*'|[^#]*?)(?=[ \t]*(?:#|$))/.exec(match[2])
    if (!rhs || rhs[0].startsWith('"""') || rhs[0].startsWith("'''")) continue
    const line = readToml(match[0])
    if (!line || !Object.is(line[name], value)) continue
    // Confirm this line starts a root assignment, outside of tables and multiline values.
    const offset = match.index
    const before = content.slice(0, offset)
    const marker = 'pqt_forge_setting_probe'
    const prefix = readToml(before + marker + ' = true\n')
    if (!prefix || prefix[marker] !== true) continue
    return {
      ambiguous: false,
      value: String(value),
      offset,
      end: offset + match[0].length,
      head: match[1],
      tail: match[2].slice(rhs[0].length)
    }
  }
  return { ambiguous: true }
}

export function readMeilisearchFields(content: string, fields: readonly CommonSetItem[]) {
  const draft = content.replace(/^\ufeff/, '')
  const document = readToml(draft)
  return fields.map((field) => {
    const setting = readSetting(draft, document, field.name)
    return {
      ...field,
      enabled: Boolean(document && Object.hasOwn(document, field.name)),
      ambiguous: setting.ambiguous,
      value: setting.value ?? field.value
    }
  })
}

export function updateMeilisearchField(
  content: string,
  field: CommonSetItem,
  enabled: boolean,
  value: string
) {
  if (/[\0\r\n]/.test(value)) return content
  const bom = content.startsWith('\ufeff') ? '\ufeff' : ''
  const draft = content.slice(bom.length)
  const setting = readSetting(draft, readToml(draft), field.name)
  if (setting.ambiguous || (enabled && value === setting.value)) return content
  const serialized = field.isString ? JSON.stringify(value) : value.trim()
  if (enabled) {
    const parsed = readToml('value = ' + serialized)
    const type = typeof parsed?.value
    if (field.isString ? type !== 'string' : !['number', 'bigint', 'boolean'].includes(type)) {
      return content
    }
  }

  const { offset, end, head, tail } = setting
  if (offset === undefined || end === undefined) {
    if (!enabled) return content
    const eol = draft.match(/\r\n|\n/)?.[0] || '\n'
    return bom + field.name + ' = ' + serialized + eol + draft
  }
  if (enabled) return bom + draft.slice(0, offset) + head + serialized + tail + draft.slice(end)

  const remainder = draft.slice(end)
  const comment = tail?.trimStart()
  const lineEnding = comment?.startsWith('#') ? remainder : remainder.replace(/^(?:\r\n|\n)/, '')
  return bom + draft.slice(0, offset) + (comment?.startsWith('#') ? comment : '') + lineEnding
}
