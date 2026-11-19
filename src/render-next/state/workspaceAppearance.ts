import { onScopeDispose, watchEffect } from 'vue'
import { AppStore } from '@/store/app'

export function useWorkspaceAppearance() {
  const store = AppStore()
  const root = document.documentElement
  const system = window.matchMedia('(prefers-color-scheme: dark)')
  const applyTheme = () => {
    const preference = store.config.setup.theme
    const dark = preference === 'dark' || (preference !== 'light' && system.matches)
    root.classList.toggle('dark', dark)
    root.classList.toggle('light', !dark)
  }

  watchEffect(applyTheme, { flush: 'sync' })
  watchEffect(() => {
    for (const [property, family] of [
      ['--pqt-preferred-ui-font', store.config.setup.appFont],
      ['--pqt-preferred-code-font', store.config.setup.codeFont]
    ] as const) {
      if (family) root.style.setProperty(property, `"${CSS.escape(family)}",`)
      else root.style.removeProperty(property)
    }
  })
  system.addEventListener('change', applyTheme)
  onScopeDispose(() => system.removeEventListener('change', applyTheme))
}
