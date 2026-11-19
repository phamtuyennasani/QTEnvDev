import { computed, reactive } from 'vue'
import { AppStore } from '@/store/app'
import type { AllAppModule } from '@/core/type'
import localForage from 'localforage'
import { ModuleCustomer, ModuleCustomerExecItem } from '@/core/ModuleCustomer'

export const AppModuleTab: Record<AllAppModule, number> = reactive({}) as any

export const AppModuleSetup = (flag: AllAppModule) => {
  const appStore = AppStore()

  const currentVersion = computed(() => {
    return appStore.config.server?.[flag]?.current?.version
  })
  if (!AppModuleTab[flag]) {
    AppModuleTab[flag] = 0
  }
  const tab = computed({
    get() {
      console.log('tab get: ', AppModuleTab, AppModuleTab[flag])
      return AppModuleTab[flag] ?? 0
    },
    set(v) {
      AppModuleTab[flag] = v
      console.log('tab set: ', v, AppModuleTab)
    }
  })

  const checkVersion = () => {
    if (!currentVersion.value) {
      AppModuleTab[flag] = 1
    }
  }

  return {
    tab,
    checkVersion
  }
}

export type CustomerModuleCateItem = {
  id: string
  label: string
  moduleType: string
}

export type CustomerModuleExecItem = {
  id: string
  name: string
  comment: string
  command: string
  commandFile: string
  commandType: 'command' | 'file'
  isSudo?: boolean
  pidPath?: string
  configPath?: Array<{
    name: string
    path: string
  }>
  logPath?: Array<{
    name: string
    path: string
  }>
}

export type CustomerModuleItem = {
  isCustomer: boolean
  id: string
  typeFlag: string
  label: string
  isService?: boolean
  isOnlyRunOne?: boolean
  icon: string
  moduleType: string
  configPath: Array<{
    name: string
    path: string
  }>
  logPath: Array<{
    name: string
    path: string
  }>
  item: ModuleCustomerExecItem[]
}

const APPCustomerModuleCateKey = 'qtenvdev-customer-module-cate'
const APPCustomerModuleKey = 'qtenvdev-customer-module'
let customerModulesLoad: Promise<void> | undefined

export const createCustomerModule = (item: CustomerModuleItem): ModuleCustomer => {
  const module = reactive(new ModuleCustomer(item))
  module.onExecStart = module.onExecStart.bind(module)
  module.start = module.start.bind(module)
  module.stop = module.stop.bind(module)
  module.watchShowHide = module.watchShowHide.bind(module)
  return module as ModuleCustomer
}

export const AppCustomerModule: {
  index: number
  moduleCate: CustomerModuleCateItem[]
  module: ModuleCustomer[]
  init: () => Promise<void>
  saveModuleCate: (categories?: readonly CustomerModuleCateItem[]) => Promise<unknown>
  saveModule: (modules?: readonly CustomerModuleItem[]) => Promise<unknown>
  addModuleCate: (item: CustomerModuleCateItem) => void
  delModuleCate: (item: CustomerModuleCateItem) => void
  currentModule?: ModuleCustomer
} = reactive({
  index: 1,
  currentModule: undefined,
  moduleCate: [],
  module: [],
  init() {
    customerModulesLoad ??= Promise.all([
      localForage.getItem<CustomerModuleCateItem[]>(APPCustomerModuleCateKey),
      localForage.getItem<CustomerModuleItem[]>(APPCustomerModuleKey)
    ]).then(([categories, definitions]) => {
      const modules = (definitions ?? []).map(createCustomerModule)
      modules.forEach((module) => module.watchShowHide())
      AppCustomerModule.moduleCate = categories ?? []
      AppCustomerModule.module = modules
    }).catch((error) => {
      customerModulesLoad = undefined
      throw error
    })
    return customerModulesLoad
  },
  saveModuleCate(categories: readonly CustomerModuleCateItem[] = AppCustomerModule.moduleCate) {
    return localForage.setItem(APPCustomerModuleCateKey, JSON.parse(JSON.stringify(categories)))
  },
  saveModule(modules: readonly CustomerModuleItem[] = AppCustomerModule.module) {
    return localForage.setItem(APPCustomerModuleKey, JSON.parse(JSON.stringify(modules)))
  },
  addModuleCate(item: CustomerModuleCateItem) {
    AppCustomerModule.moduleCate.unshift(item)
    AppCustomerModule.saveModuleCate().catch(console.error)
  },
  delModuleCate(item: CustomerModuleCateItem) {
    const service = AppCustomerModule.module.filter((f) => f.moduleType !== item.moduleType)
    AppCustomerModule.module = reactive(service)
    const findIndex = AppCustomerModule.moduleCate.findIndex((f) => f.id === item.id)
    if (findIndex >= 0) {
      AppCustomerModule.moduleCate.splice(findIndex, 1)
    }
    AppCustomerModule.saveModuleCate().catch(console.error)
    AppCustomerModule.saveModule().then().catch()
  }
})
