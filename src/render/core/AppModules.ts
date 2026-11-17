import { markRaw, reactive } from 'vue'
import type { AppModuleItem } from '@/core/type'

const modules = import.meta.glob('@/components/*/Module.ts', { eager: true })
console.log('modules: ', modules)

const AppModules: AppModuleItem[] = reactive([])
for (const key in modules) {
  const module: any = modules[key]
  AppModules.push(markRaw(module.default))
}

AppModules.sort((a, b) => {
  return a.asideIndex! - b.asideIndex!
})

export { AppModules }
