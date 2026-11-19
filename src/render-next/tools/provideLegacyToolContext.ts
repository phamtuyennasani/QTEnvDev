import { getCurrentInstance, type App, markRaw, toRaw } from 'vue'
import * as ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import VueSvg from '@/components/VueSvgIcon/use.vue'
import { I18nT } from '@lang/index'
import Base from '@/core/Base'
import '../styles/legacy-tools.scss'

export function provideLegacyToolContext() {
  const instance = getCurrentInstance()!
  const parentContext = instance.appContext
  const components = { ...parentContext.components, YbIcon: VueSvg }
  for (const [name, component] of Object.entries(ElementPlus)) if (/^El[A-Z]/.test(name) && component && (typeof component === 'object' || typeof component === 'function')) Object.assign(components, { [name]: component })
  const context = { ...parentContext, components, directives: { ...parentContext.directives, loading: ElementPlus.ElLoading.directive }, config: { ...parentContext.config, globalProperties: { ...parentContext.config.globalProperties, $t: I18nT, markRaw, toRaw } } }
  Base.init({ config: context.config } as unknown as App)
  instance.appContext = context
}
