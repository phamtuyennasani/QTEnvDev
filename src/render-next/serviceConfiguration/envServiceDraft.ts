import type { CommonSetItem } from '@/components/Conf/setup'
import { readConfigValue } from '@shared/ServiceWebAddress'

export type EnvService = 'n8n' | 'mailpit' | 'minio' | 'rustfs'

function splitDraft(content: string) {
  const bom = content.startsWith('\uFEFF') ? '\uFEFF' : ''
  const parts = content.slice(bom.length).split(/(\r\n|\n|\r)/)
  const lines = []
  for (let index = 0; index < parts.length; index += 2) {
    if (index === parts.length - 1 && !parts[index]) break
    const text = parts[index]
    const assignment = /^([ \t]*)([A-Za-z_][A-Za-z0-9_]*)([ \t]*)=(.*)$/.exec(text)
    lines.push({ text, ending: parts[index + 1] ?? '', assignment })
  }
  return { bom, lines }
}

function parseSetting(draft: ReturnType<typeof splitDraft>, name: string, engine: EnvService) {
  const matches = draft.lines.filter((line) => line.assignment?.[2] === name)
  const target = matches[0]
  const assignment = target?.assignment
  const ambiguous = matches.length > 1 || (engine !== 'minio' && Boolean(assignment?.[3]))
  const raw = engine === 'minio' ? assignment?.[4].trim() : assignment?.[4].trimEnd()
  // The launchers differ on spacing and boundary quotes.
  const value =
    engine === 'n8n'
      ? raw?.replace(/^["']|["']$/g, '')
      : engine === 'minio' && target
        ? readConfigValue(target.text, name)
        : raw
  return { target, ambiguous, raw, value }
}

export function readEnvServiceFields(
  content: string,
  engine: EnvService,
  fields: readonly CommonSetItem[]
) {
  const draft = splitDraft(content)
  return fields.map((field) => {
    const existing = parseSetting(draft, field.name, engine)
    return {
      ...field,
      enabled: Boolean(existing.target),
      ambiguous: existing.ambiguous,
      value: existing.value ?? field.value
    }
  })
}

export function updateEnvServiceField(
  content: string,
  engine: EnvService,
  field: CommonSetItem,
  enabled: boolean,
  value: string
) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field.name) || /[\0\r\n]/.test(value)) return content
  const draft = splitDraft(content)
  const { target, ambiguous, raw, value: existing } = parseSetting(draft, field.name, engine)
  if (ambiguous || (enabled && target && value === existing)) return content

  const firstQuote = raw?.[0]
  const oldQuote =
    firstQuote && /["']/.test(firstQuote) && raw?.at(-1) === firstQuote ? firstQuote : ''
  const quote =
    (engine === 'n8n' || engine === 'minio') &&
    (oldQuote || field.isString || /^[\s"']|[\s"']$/.test(value))
      ? oldQuote || '"'
      : ''
  const assignment = `${field.name}=${quote}${value}${quote}`
  if (target) {
    if (enabled) target.text = (target.assignment?.[1] ?? '') + assignment
    else draft.lines.splice(draft.lines.indexOf(target), 1)
  } else if (enabled) {
    const ending = draft.lines.find((line) => line.ending)?.ending || '\n'
    const last = draft.lines.at(-1)
    if (last && !last.ending) last.ending = ending
    draft.lines.push({ text: assignment, ending, assignment: null })
  }
  return draft.bom + draft.lines.map(({ text, ending }) => text + ending).join('')
}
