import { computed, reactive } from 'vue'
import IPC from '@/util/IPC'
export type LogLevel = 'info' | 'success' | 'warning' | 'error'
export type LogEntry = { id: number; time: string; source: string; level: LogLevel; message: string }
const entries = reactive<LogEntry[]>([])
let listening = false
const addMessage = (raw: string) => {
  const match = raw.match(/^\[(.*?)\] \[(debug|info|error)\] : (.*)$/)
  const level = match?.[2] === 'error' ? 'error' : match?.[2] === 'debug' ? 'info' : 'info'
  const message = match?.[3] ?? raw
  const source = message.match(/^\[([^\]]+)\] (.*)$/)
  entries.unshift({ id: Date.now(), time: match?.[1]?.slice(-8) ?? new Date().toLocaleTimeString(), source: source?.[1] ?? 'system', level, message: source?.[2] ?? message })
}
export function startLogListener() {
  if (listening) return
  listening = true
  IPC.on('APP-On-Log').then((_key: string, message: string) => addMessage(message))
}
const query = reactive({ value: '' }); const level = reactive<{ value: 'All' | LogLevel }>({ value: 'All' })
export const logController = { entries, query, level, levels: ['All', 'info', 'success', 'warning', 'error'] as const, filtered: computed(() => entries.filter((entry) => { const textMatch = `${entry.source} ${entry.message}`.toLowerCase().includes(query.value.toLowerCase()); return textMatch && (level.value === 'All' || entry.level === level.value) })), clear() { entries.splice(0, entries.length) } }
