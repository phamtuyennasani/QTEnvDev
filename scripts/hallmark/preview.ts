export {}

// Renderer-only visual fixture: IPC is replaced before any application module loads.
const { parse: parseToml } = await import('toml')
const errors: string[] = []
window.addEventListener('error', (event) => errors.push(event.message))
window.addEventListener('unhandledrejection', (event) =>
  errors.push(event.reason?.stack ?? String(event.reason))
)
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
        if (['existsSync', 'exists'].includes(method))
          result = /^\/visual-fixture\/php\/php\.ini(?:\.default)?$/.test(String(args[2]))
        else if (method === 'readFile')
          result = '; Visual fixture only\n[PHP]\nmemory_limit = 256M\ndisplay_errors = On\n'
        else if (['readdir', 'readdirSync'].includes(method)) result = []
      } else if (namespace === 'ip' && method === 'address_list')
        result = [{ ip: '127.0.0.1', isVirtual: false, name: 'fixture' }]
      else if (namespace === 'app' && method === 'getVersion') result = '4.21.0'
      else if (namespace === 'app' && method === 'getPath') result = '/visual-fixture'
      else if (namespace === 'nativeTheme' && method === 'shouldUseDarkColors') result = false
      else if (namespace === 'toml' && method === 'parse') {
        try {
          result = parseToml(args[2])
        } catch {
          result = null
        }
      } else if (namespace === 'dialog') result = { canceled: true, filePaths: [] }
    } else if (command.startsWith('app-fork:')) {
      result = { code: 0, data: [] }
      if (args[0] === 'allInstalledVersions') result = { code: 0, data: {} }
      else if (args[0] === 'getIniPath') result = { code: 0, data: '/visual-fixture/php/php.ini' }
      else if (args[0] === 'fetchLoadedExtensions')
        result = {
          code: 0,
          data: [{ name: 'Core' }, { name: 'json' }, { name: 'openssl' }, { name: 'pdo_mysql' }]
        }
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
const { createApp, createVNode, render, reactive, nextTick } = await import('vue')
const { reactiveBind } = await import('@/util/Index')
const { createPinia } = await import('pinia')
const { default: ElementPlus } = await import('element-plus')
await import('element-plus/dist/index.css')
await import('element-plus/theme-chalk/dark/css-vars.css')
await import('@/index.scss')
await import('@/style/index.scss')
await import('@/style/dark.scss')
await import('@/style/light.scss')
await import('@/style/tokens.css')
await import('@/style/workbench.scss')
const { AppI18n, applyLanguagePayload } = await import('@lang/runtime')
const { default: english } = await import('@lang/en')
applyLanguagePayload({
  locale: 'en',
  fallbackLocale: 'en',
  messages: english.en,
  fallbackMessages: english.en
})
const { default: router } = await import('@/router/index')
const { default: App } = await import('@/App.vue')
const { default: Icon } = await import('@/components/VueSvgIcon/use.vue')
const { default: Base } = await import('@/core/Base')
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
type StartupGroupFaultTarget = 'candidates' | 'save'
type StartupGroupFaultMode = 'pass' | 'reject' | 'hold'
const startupGroupFaults = {
  candidates: {
    mode: 'pass' as StartupGroupFaultMode,
    calls: 0,
    pending: [] as ((failed?: boolean) => void)[]
  },
  save: {
    mode: 'pass' as StartupGroupFaultMode,
    calls: 0,
    pending: [] as ((failed?: boolean) => void)[]
  }
}
const startupGroupFaultMessages = {
  candidates: 'Fixture candidate source unavailable <fixture-error>',
  save: 'Fixture storage write rejected <fixture-error>'
}
let startupGroupFaultsInstalled = false
const startupGroupFaultBoundary = async (target: StartupGroupFaultTarget) => {
  const fault = startupGroupFaults[target]
  fault.calls += 1
  if (fault.mode === 'reject') throw new Error(startupGroupFaultMessages[target])
  if (fault.mode === 'hold') {
    await new Promise<void>((resolve, reject) => {
      fault.pending.push((failed = false) =>
        failed ? reject(new Error(startupGroupFaultMessages[target])) : resolve()
      )
    })
  }
}
const startupGroupFaultSnapshot = () =>
  Object.fromEntries(
    Object.entries(startupGroupFaults).map(([target, fault]) => [
      target,
      { mode: fault.mode, calls: fault.calls, pending: fault.pending.length }
    ])
  )
const installStartupGroupFaults = async () => {
  if (startupGroupFaultsInstalled) return
  const { StartupGroupManager } =
    await import('@/components/StartupGroup/class/StartupGroupManager')
  const { default: localForage } = await import('localforage')
  const listCandidates = StartupGroupManager.runtime.listCandidates.bind(
    StartupGroupManager.runtime
  )
  const setItem = localForage.setItem.bind(localForage)
  StartupGroupManager.runtime.listCandidates = async () => {
    await startupGroupFaultBoundary('candidates')
    return listCandidates()
  }
  localForage.setItem = async (key, value, callback) => {
    if (key === 'qtenvdev-startup-groups') await startupGroupFaultBoundary('save')
    return setItem(key, value, callback)
  }
  startupGroupFaultsInstalled = true
}
const { AppStore } = await import('@/store/app')
const { BrewStore } = await import('@/store/brew')
const { AppModules } = await import('@/core/AppModules')
const { Module } = await import('@/core/Module/Module')
const { ModuleInstalledItem } = await import('@/core/Module/ModuleInstalledItem')
const { AppModuleTab, AppCustomerModule } = await import('@/core/Module')
const { ModuleCustomer } = await import('@/core/ModuleCustomer')
const store = AppStore()
store.config.setup.theme = 'light'
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
AppCustomerModule.currentModule = reactiveBind(
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
// Register the application's editor contributions before setTheme initializes
// Monaco's standalone services, including when Tools is the first audited route.
await import('@/util/Editor')
await router.push('/startup-group')
await router.isReady()
app.mount('#app')
let overlayMount: HTMLElement | undefined
;(window as any).hallmark = {
  closeOverlay() {
    if (overlayMount) {
      render(null, overlayMount)
      overlayMount.remove()
      overlayMount = undefined
    }
  },
  async openOverlay(name: string) {
    this.closeOverlay()
    const version = {
      version: '8.4.0',
      path: '/visual-fixture/php',
      bin: '/visual-fixture/php/bin/php',
      phpBin: '/visual-fixture/php/bin/php',
      flag: 'static'
    }
    let component: any
    let props: any = {}
    if (name === 'host-edit') {
      component = (await import('@/components/Host/Edit.vue')).default
      props = {
        isEdit: true,
        edit: {
          id: 'fixture-site',
          type: 'php',
          name: 'qtenvdev.test',
          alias: 'www.qtenvdev.test',
          root: '/visual-fixture/qtenvdev/public',
          mark: 'Visual fixture',
          phpVersion: 84,
          port: { nginx: 80, apache: 80, caddy: 80, frankenphp: 80 },
          ssl: { cert: '', key: '' },
          useSSL: false
        }
      }
    } else if (name === 'podman-machine') {
      component = (await import('@/components/Podman/machine/machineAdd.vue')).default
    } else if (name === 'podman-container') {
      component = (await import('@/components/Podman/container/containerCreate.vue')).default
    } else if (name === 'php-extensions') {
      component = (await import('@/components/PHP/Extends.vue')).default
      props = { version }
    } else if (name === 'php-config') {
      component = (await import('@/components/PHP/Config.vue')).default
      props = { version }
    } else {
      throw new Error('Unknown visual overlay: ' + name)
    }
    overlayMount = document.createElement('div')
    document.body.append(overlayMount)
    const vnode = createVNode(component, props)
    vnode.appContext = app._context
    render(vnode, overlayMount)
    await nextTick()
  },
  errors,
  AppModuleTab,
  store,
  async setLocale(locale: 'en' | 'vi') {
    const messages = locale === 'vi' ? (await import('@lang/vi')).default.vi : english.en
    applyLanguagePayload({ locale, fallbackLocale: 'en', messages, fallbackMessages: english.en })
    window.Server.Lang = locale
    store.config.setup.lang = locale
    await nextTick()
  },
  async startupGroupSnapshot() {
    const { StartupGroupManager } =
      await import('@/components/StartupGroup/class/StartupGroupManager')
    return JSON.parse(JSON.stringify(StartupGroupManager.store.config))
  },
  async startupGroupPersistedSnapshot() {
    const { StorageGetAsync } = await import('@/util/Storage')
    const value = await StorageGetAsync('qtenvdev-startup-groups')
    return value ? JSON.parse(JSON.stringify(value)) : null
  },
  async startupGroupFault(target: StartupGroupFaultTarget, mode: StartupGroupFaultMode) {
    await installStartupGroupFaults()
    startupGroupFaults[target].mode = mode
    return startupGroupFaultSnapshot()
  },
  startupGroupFaultSnapshot,
  releaseStartupGroupFault(target: StartupGroupFaultTarget, failed = false) {
    const release = startupGroupFaults[target].pending.shift()
    if (!release) throw new Error('No pending fixture fault: ' + target)
    release(failed)
    return startupGroupFaultSnapshot()
  },
  async setTheme(theme: 'light' | 'dark') {
    store.config.setup.theme = theme
    document.documentElement.className = theme
    const { editor } = await import('monaco-editor/esm/vs/editor/editor.api.js')
    editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs-light')
    await nextTick()
  },
  setServiceState(flag: string, state: string) {
    const module = BrewStore().module(flag)
    module.fetchInstalleding = state === 'loading'
    module.installed =
      state === 'empty' || state === 'loading'
        ? []
        : (state === 'busy' ? ['starting', 'running'] : ['stopped', 'running', 'unavailable']).map(
            (kind, index) =>
              reactiveBind(
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
    if (name.startsWith('podman-')) {
      const { PodmanManager } = await import('@/components/Podman/class/Podman')
      const { Machine } = await import('@/components/Podman/class/Machine')
      PodmanManager.loading = name === 'podman-loading'
      PodmanManager.inited = true
      PodmanManager.version = 'Fixture 1.0.0'
      PodmanManager.machine =
        name === 'podman-empty'
          ? []
          : [reactiveBind(new Machine({ name: 'fixture-machine', info: { State: 'stopped' } }))]
      PodmanManager.tab = 'fixture-machine'
      if (PodmanManager.machine[0] && name === 'podman-containers') {
        const { Container } = await import('@/components/Podman/class/Container')
        const machine = PodmanManager.machine[0]
        machine.run = true
        machine.tab = 'Container'
        machine.container = ['running', 'stopped'].map((state, index) =>
          reactiveBind(
            new Container({
              id: 'fixture-' + index,
              name: ['qtenvdev-' + state],
              Image: 'docker.io/library/nginx:stable',
              machineName: machine.name,
              run: state === 'running'
            })
          )
        )
      }
      if (PodmanManager.machine[0] && name === 'podman-compose') {
        PodmanManager.machine[0].run = true
        PodmanManager.machine[0].tab = 'Compose'
      }
    } else if (name.startsWith('project-')) {
      const { ProjectSetup } = await import('@/components/LanguageProjects/setup')
      const { ProjectItem } = await import('@/components/LanguageProjects/ProjectItem')
      const flag = name.startsWith('project-php') ? 'php' : 'node'
      const project = ProjectSetup(flag)
      project.fetching = name === 'project-loading'
      project.project = ['stopped', 'running'].map((state, index) => {
        const item = reactiveBind(
          new ProjectItem({
            id: 'fixture-project-' + index,
            path: '/visual-fixture/project-' + index,
            comment: 'Fixture project ' + index,
            binVersion: flag === 'php' ? '8.4.0' : '22.0.0',
            typeFlag: flag,
            isService: true,
            projectPort: 3000 + index
          })
        )
        item.state.isRun = state === 'running'
        return item
      })
      AppModuleTab[flag] = 0
    } else if (name === 'hosts-populated') {
      const { HostStore } = await import('@/components/Host/store')
      HostStore.tab = 'php'
      HostStore._list.php = [
        {
          id: 1,
          type: 'php',
          name: 'qtenvdev.test',
          root: '/visual-fixture/qtenvdev/public',
          alias: 'www.qtenvdev.test',
          mark: 'Fixture · local application',
          phpVersion: 84
        },
        {
          id: 2,
          type: 'php',
          name: 'docs.qtenvdev.test',
          root: '/visual-fixture/docs',
          alias: '',
          mark: 'Fixture · static documentation'
        }
      ].map((site) => ({
        ...site,
        useSSL: false,
        autoSSL: false,
        ssl: { cert: '', key: '' },
        port: {
          nginx: 80,
          apache: 80,
          caddy: 80,
          tomcat: 8080,
          nginx_ssl: 443,
          apache_ssl: 443,
          caddy_ssl: 443,
          tomcat_ssl: 8443
        },
        nginx: { rewrite: '' },
        url: ''
      }))
      store.hosts = HostStore._list.php
      HostStore.index += 1
    } else if (name === 'custom-populated') {
      const { ModuleCustomerExecItem } = await import('@/core/ModuleCustomer')
      AppCustomerModule.currentModule!.item = ['stopped', 'running'].map((state, index) => {
        const item = reactiveBind(
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
    } else if (name.startsWith('json-')) {
      const { AppToolStore } = await import('@/components/Tools/store')
      const { default: JSONStore } = await import('@/components/Tools/Json/store')
      AppToolStore.id = 'JsonParse'
      const { editor } = await import('monaco-editor/esm/vs/editor/editor.api.js')
      const end = Date.now() + 15000
      while (
        !editor.getEditors().some((item) => item.getDomNode()?.closest('.app-json-workspace .left'))
      ) {
        if (Date.now() > end) throw new Error('JSON fixture editor did not mount')
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      const input = editor
        .getEditors()
        .find((item) => item.getDomNode()?.closest('.app-json-workspace .left'))!
      const value =
        name === 'json-invalid'
          ? '{ invalid JSON'
          : JSON.stringify(
              { name: 'QTEnvDev', environment: 'development', services: ['PHP', 'MySQL'] },
              null,
              2
            )
      input.setValue(value)
      // The production input listener parses asynchronously, including the TOML fallback.
      while (
        name === 'json-invalid'
          ? JSONStore.tabs['tab-1'].type !== english.en.tools.inputCheckFailTips
          : JSONStore.tabs['tab-1'].type !== 'JSON'
      ) {
        if (Date.now() > end) throw new Error('JSON fixture parse did not settle')
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    } else if (name === 'groups-editor') {
      const { StartupGroupManager } =
        await import('@/components/StartupGroup/class/StartupGroupManager')
      const { ProjectSetup } = await import('@/components/LanguageProjects/setup')
      const { ProjectItem } = await import('@/components/LanguageProjects/ProjectItem')
      await StartupGroupManager.store.init()
      StartupGroupManager.store.groups = []
      StartupGroupManager.store.defaultStartupGroupId = undefined
      for (const flag of ['apache', 'php'] as const) {
        BrewStore().module(flag).installed = ['1.0.0', '2.0.0'].map((version, index) =>
          reactiveBind(
            new ModuleInstalledItem({
              typeFlag: flag,
              version,
              path: `/visual-fixture/${flag}/${index}`,
              bin: `/visual-fixture/${flag}/${index}/bin`,
              enable: true,
              port: 8080
            } as any)
          )
        )
      }
      for (const module of AppModules.filter((item) => item.moduleType === 'language')) {
        const source = ProjectSetup(module.typeFlag)
        await source.fetchProject()
        source.project =
          module.typeFlag === 'node'
            ? [
                reactiveBind(
                  new ProjectItem({
                    id: 'fixture-editor-project',
                    path: '/visual-fixture/teams/development/projects/application-with-a-long-folder-name/server',
                    comment: 'Fixture application with a long service name for layout verification',
                    typeFlag: 'node',
                    isService: true,
                    projectPort: 8080
                  })
                )
              ]
            : []
        source.fetched = true
      }
    } else if (name === 'groups-populated') {
      const { StartupGroupManager } =
        await import('@/components/StartupGroup/class/StartupGroupManager')
      const { StartupGroup } = await import('@/components/StartupGroup/class/StartupGroup')
      const module = BrewStore().module('apache')
      module.installed = [
        reactiveBind(
          new ModuleInstalledItem({
            version: '1.0.0',
            path: '/visual-fixture/apache',
            bin: '/visual-fixture/apache/bin',
            run: true
          } as any)
        )
      ]
      StartupGroupManager.store.groups = [
        reactiveBind(
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
