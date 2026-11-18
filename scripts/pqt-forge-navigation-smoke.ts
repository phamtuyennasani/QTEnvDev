import { readFileSync } from 'node:fs'
const app = readFileSync('src/render-next/AppNext.vue', 'utf8')
const palette = readFileSync('src/render-next/components/CommandPalette.vue', 'utf8')
for (const marker of ['event.key', 'navigation.find', 'commandPalette.value?.show']) if (!app.includes(marker)) throw new Error(`Navigation missing ${marker}`)
for (const marker of ['Open logs', "workspace: 'logs'"]) if (!palette.includes(marker)) throw new Error(`Command palette missing ${marker}`)
console.log('PQT Forge navigation smoke check passed (keyboard shortcuts and logs command).')
