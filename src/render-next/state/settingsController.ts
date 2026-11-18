import { reactive } from 'vue'
import { StorageGetAsync, StorageSetAsync } from '@/util/Storage'

const storageKey = 'pqt-forge-settings'

export const settingsController = reactive({
  theme: 'Dark graphite',
  language: 'English',
  autoStart: true,
  trayOnClose: true,
  compactSidebar: false,
  version: '1.0.0'
})
export async function loadSettings() {
  const saved = await StorageGetAsync<Partial<typeof settingsController>>(storageKey)
  if (saved) Object.assign(settingsController, saved)
}
export async function saveSettings() {
  await StorageSetAsync(storageKey, JSON.parse(JSON.stringify(settingsController)))
}
