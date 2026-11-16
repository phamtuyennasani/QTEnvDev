// Renderer-only visual fixture: IPC is replaced before any application module loads.
const errors: string[] = []
window.addEventListener('error', (event) => errors.push(event.message))
window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)))
let receive: (...args: any[]) => void
;(window as any).QTEnvDevNodeAPI = {
  ipcReceiveFromMain: (callback: any) => {
    receive = callback
  },
  ipcSendToMain: (command: string, key: string, ...args: any[]) => {
    let result: any = { code: 0, data: [] }
    if (command === 'App-Node-FN') {
      const [namespace, method] = args
      if (namespace === 'fs') {
        if (['existsSync', 'exists'].includes(method)) result = false
        else if (method === 'readFile') result = ''
        else if (['readdir', 'readdirSync'].includes(method)) result = []
      } else if (namespace === 'ip' && method === 'address_list')
        result = [{ ip: '127.0.0.1', isVirtual: false, name: 'fixture' }]
      else if (namespace === 'app' && method === 'getVersion') result = '4.21.0'
      else if (namespace === 'app' && method === 'getPath') result = '/visual-fixture'
      else if (namespace === 'dialog') result = { canceled: true, filePaths: [] }
    } else if (command.startsWith('app-fork:')) {
      result = { code: 0, data: [] }
      if (args[0] === 'allInstalledVersions') result = { code: 0, data: {} }
      else if (args[0] === 'podmanInit') result = { code: 0, data: { version: '', machine: [] } }
    }
    setTimeout(() => receive?.({}, command, key, result), 0)
  },
  showFilePath: () => ''
}
const fixturePlatform = new URLSearchParams(location.search).get('platform') ?? 'windows'
;(window as any).Server = {
  isWindows: fixturePlatform === 'windows',
  isMacOS: fixturePlatform === 'macos',
  isLinux: fixturePlatform === 'linux',
  isArmArch: false,
  DataDirectoryReady: false,
  BaseDir: '/visual-fixture/',
  Cache: '/visual-fixture/cache/',
  Static: '/visual-fixture/static/',
  UserHome: '/visual-fixture/home/',
  AppDir: '/visual-fixture/',
  AppVersion: '4.21.0',
  Port: 8080,
  Lang: 'en'
}
const { createApp, reactive, nextTick } = await import('vue')
const { createPinia } = await import('pinia')
const { default: ElementPlus } = await import('element-plus')
await import('element-plus/dist/index.css')
await import('element-plus/theme-chalk/dark/css-vars.css')
await import('/index.scss')
await import('/style/index.scss')
await import('/style/dark.scss')
await import('/style/light.scss')
await import('/style/tokens.css')
await import('/style/workbench.scss')
const { AppI18n, applyLanguagePayload } = await import('@lang/runtime')
const { default: english } = await import('@lang/en')
applyLanguagePayload({
  locale: 'en',
  fallbackLocale: 'en',
  messages: english.en,
  fallbackMessages: english.en
})
const { default: router } = await import('/router/index.ts')
const { default: App } = await import('/App.vue')
const { default: Icon } = await import('/components/VueSvgIcon/use.vue')
const { default: Svg } = await import('/components/VueSvgIcon/svg.vue')
const { default: Base } = await import('/core/Base.ts')
const app = createApp(App)
app.use(createPinia()).use(ElementPlus).use(AppI18n()).use(router).component('YbIcon', Icon)
app.config.errorHandler = (error) => errors.push(String(error))
app.mixin({
  beforeCreate() {
    this.$children = new Set()
  },
  created() {
    this._uid = this.$.uid
    this.$parent?.$children?.add(this)
  },
  beforeUnmount() {
    this.$parent?.$children?.delete(this)
  }
})
Base.init(app)
const { AppStore } = await import('/store/app.ts')
const { BrewStore } = await import('/store/brew.ts')
const { AppModules } = await import('/core/AppModules.ts')
const { Module } = await import('/core/Module/Module.ts')
const { ModuleInstalledItem } = await import('/core/Module/ModuleInstalledItem.ts')
const { AppModuleTab, AppCustomerModule } = await import('/core/Module.ts')
const { ModuleCustomer } = await import('/core/ModuleCustomer.ts')
const store = AppStore()
store.config.setup.lang = 'en'
store.config.setup.autoCheck = false
store.config.setup.hosts.write = false
store.config.setup.phpBrewInitiated = true
store.versionInitiated = true
store.saveConfig = async () => true
for (const item of AppModules) {
  const module = reactive(new Module())
  module.typeFlag = item.typeFlag
  module.installedFetched = true
  module.isService = !!item.isService
  module.fetchInstalled = async () => true
  BrewStore().modules[item.typeFlag] = module
  store.config.server[item.typeFlag] = { current: { version: 'fixture' } }
}
AppCustomerModule.currentModule = reactive(
  new ModuleCustomer({
    id: 'preview-custom',
    typeFlag: 'preview-custom',
    label: 'Custom service',
    isCustomer: true,
    isService: true,
    moduleType: 'other',
    configPath: [],
    logPath: [],
    item: []
  })
)
AppCustomerModule.module = [AppCustomerModule.currentModule]
document.documentElement.className = 'light'
await router.push('/startup-group')
await router.isReady()
app.mount('#app')
;(window as any).hallmark = {
  errors,
  AppModuleTab,
  store,
  setServiceState(flag: string, state: string) {
    const module = BrewStore().module(flag)
    module.fetchInstalleding = state === 'loading'
    module.installed =
      state === 'empty' || state === 'loading'
        ? []
        : (state === 'busy' ? ['starting', 'running'] : ['stopped', 'running', 'unavailable']).map(
            (kind, index) =>
              reactive(
                new ModuleInstalledItem({
                  typeFlag: flag,
                  version: kind === 'unavailable' ? '' : `1.0.${index}`,
                  path: `/visual-fixture/${flag}/${kind}`,
                  bin: `/visual-fixture/${flag}/${kind}/bin`,
                  enable: kind !== 'unavailable',
                  run: kind === 'running',
                  running: kind === 'starting',
                  error: kind === 'unavailable' ? 'Fixture: executable unavailable' : undefined
                } as any)
              )
          )
  },
  async scenario(name: string) {
    if (name.startsWith('cli-')) {
      const { CodexSetup } = await import('/components/Codex/setup.ts')
      CodexSetup.loading = name === 'cli-loading'
      CodexSetup.installed = true
      CodexSetup.version = 'Fixture 1.0.0'
      CodexSetup.sessions = [
        {
          id: 'visual-session',
          title: 'Fixture session',
          lastPrompt: 'Review a local project',
          workDir: '/visual-fixture/project',
          updatedAt: '2026-11-17T09:00:00Z'
        }
      ]
      CodexSetup.sessionLoading = name === 'cli-sessions-loading'
      AppModuleTab.codex = name.includes('sessions') ? 2 : 0
    } else if (name.startsWith('mcp-')) {
      const { MCPSetup } = await import('/components/MCP/setup.ts')
      MCPSetup.running = name === 'mcp-running'
      MCPSetup.starting = name === 'mcp-starting'
    } else if (name.startsWith('podman-')) {
      const { PodmanManager } = await import('/components/Podman/class/Podman.ts')
      const { Machine } = await import('/components/Podman/class/Machine.ts')
      PodmanManager.loading = name === 'podman-loading'
      PodmanManager.inited = true
      PodmanManager.version = 'Fixture 1.0.0'
      PodmanManager.machine =
        name === 'podman-empty'
          ? []
          : [reactive(new Machine({ name: 'fixture-machine', info: { State: 'stopped' } }))]
      PodmanManager.tab = 'fixture-machine'
      if (PodmanManager.machine[0] && name === 'podman-compose') {
        PodmanManager.machine[0].run = true
        PodmanManager.machine[0].tab = 'Compose'
      }
    } else if (name.startsWith('project-')) {
      const { ProjectSetup } = await import('/components/LanguageProjects/setup.ts')
      const { ProjectItem } = await import('/components/LanguageProjects/ProjectItem.ts')
      const project = ProjectSetup('node')
      project.fetching = name === 'project-loading'
      project.project = ['stopped', 'running'].map((state, index) => {
        const item = reactive(
          new ProjectItem({
            id: 'fixture-project-' + index,
            path: '/visual-fixture/project-' + index,
            comment: 'Fixture project ' + index,
            binVersion: '22.0.0',
            isService: true,
            projectPort: 3000 + index
          })
        )
        item.state.isRun = state === 'running'
        return item
      })
      AppModuleTab.node = 0
    } else if (name.startsWith('plugins-')) {
      const { PluginMarket } = await import('/components/Setup/Plugins/controller.ts')
      const { SetupStore } = await import('/components/Setup/store.ts')
      SetupStore().tab = 'plugins'
      await nextTick()
      await PluginMarket.refresh()
      PluginMarket.loading = name === 'plugins-loading'
      PluginMarket.error =
        name === 'plugins-error' ? 'Fixture: catalog unavailable. Try refreshing.' : ''
      PluginMarket.restartRequired = name === 'plugins-success'
      PluginMarket.catalog =
        name === 'plugins-populated'
          ? [
              {
                id: 'fixture-plugin',
                name: 'Fixture plugin',
                version: '1.0.0',
                description: 'Visual fixture only',
                official: true,
                compatible: true,
                artifact: { url: 'https://example.invalid/plugin.zip' }
              }
            ]
          : []
    } else if (name === 'custom-populated') {
      const { ModuleCustomerExecItem } = await import('/core/ModuleCustomer.ts')
      AppCustomerModule.currentModule!.item = ['stopped', 'running'].map((state, index) => {
        const item = reactive(
          new ModuleCustomerExecItem({
            id: 'fixture-custom-' + index,
            name: 'Fixture service ' + index,
            comment: 'Visual state only',
            command: ''
          })
        )
        item.run = state === 'running'
        return item
      })
    } else if (name === 'groups-populated') {
      const { StartupGroupManager } =
        await import('/components/StartupGroup/class/StartupGroupManager.ts')
      const { StartupGroup } = await import('/components/StartupGroup/class/StartupGroup.ts')
      const module = BrewStore().module('apache')
      module.installed = [
        reactive(
          new ModuleInstalledItem({
            version: '1.0.0',
            path: '/visual-fixture/apache',
            bin: '/visual-fixture/apache/bin',
            run: true
          } as any)
        )
      ]
      StartupGroupManager.store.groups = [
        reactive(
          new StartupGroup(
            {
              id: 'fixture-group',
              name: 'Fixture startup group',
              description: 'Running and unavailable members',
              createdAt: 0,
              updatedAt: 0,
              items: [
                {
                  id: 'one',
                  type: 'service-version',
                  module: 'apache',
                  versionPath: '/visual-fixture/apache',
                  versionBin: '/visual-fixture/apache/bin'
                },
                {
                  id: 'two',
                  type: 'service-version',
                  module: 'mysql',
                  versionPath: '/visual-fixture/missing',
                  versionBin: '/visual-fixture/missing/bin'
                }
              ]
            } as any,
            StartupGroupManager.runner
          )
        )
      ]
    }
    await nextTick()
  },
  routes: AppModules.map((item) => ({
    route: '/' + item.typeFlag,
    label: typeof item.label === 'function' ? item.label() : item.label
  })),
  async navigate(route: string) {
    errors.length = 0
    store.currentPage = route === '/customer-module' ? '/preview-custom' : route
    await router.push(route)
    await nextTick()
  }
}
