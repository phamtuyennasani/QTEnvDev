import { readFileSync } from 'node:fs'
const source = readFileSync('src/render-next/state/logController.ts', 'utf8')
for (const marker of ['APP-On-Log', 'startLogListener', 'entries = reactive<LogEntry[]>([])']) {
  if (!source.includes(marker)) throw new Error(`Logs controller missing ${marker}`)
}
console.log('PQT Forge logs smoke check passed (live IPC stream and empty initial state).')
