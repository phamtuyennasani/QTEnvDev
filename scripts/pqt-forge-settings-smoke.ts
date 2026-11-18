import { readFileSync } from 'node:fs'
const controller = readFileSync('src/render-next/state/settingsController.ts', 'utf8')
const screen = readFileSync('src/render-next/screens/SettingsScreen.vue', 'utf8')
for (const marker of ['StorageGetAsync', 'StorageSetAsync', 'loadSettings', 'saveSettings']) {
  if (!controller.includes(marker)) throw new Error(`Settings controller missing ${marker}`)
}
if (!screen.includes('@click="persist"')) throw new Error('Settings screen does not persist changes')
console.log('PQT Forge settings smoke check passed (persistent settings contract present).')
