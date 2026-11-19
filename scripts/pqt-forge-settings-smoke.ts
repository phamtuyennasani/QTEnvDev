import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electron from 'electron'
import { createServer } from 'vite'
import viteConfig from '../configs/vite.config'

const directory = await mkdtemp(join(tmpdir(), 'pqt-settings-ui-'))
const fixtureName = '.settings-ui-' + process.pid + '.html'
const fixture = resolve('src/render-next', fixtureName)
const startupFixtureName = '.settings-startup-' + process.pid + '.html'
const startupFixture = resolve('src/render-next', startupFixtureName)
const server = await createServer({
  ...viteConfig.serverConfig,
  configFile: false,
  cacheDir: join(directory, 'vite'),
  server: { port: 0, host: '127.0.0.1', hmr: false }
})

const fixtureHtml = String.raw`<!doctype html><div id="app"></div>
<script>
  const windows = location.search === '?windows'
  window.Server = { isWindows: windows, isLinux: !windows, isMacOS: false }
  window.preferences = []
  window.settingsErrors = []
  let receive
  window.QTEnvDevNodeAPI = {
    ipcReceiveFromMain(fn) { receive = fn },
    ipcSendToMain(channel, key, ...args) {
      const [scope, action] = args
      let response
      if (channel === 'application:save-preference') {
        preferences.push(scope.setup)
        response = { code: 0 }
      } else if (channel === 'application:language-list-custom') response = { code: 0, data: [] }
      else if (scope === 'nativeTheme' && action === 'shouldUseDarkColors') response = true
      else if (scope === 'app' && action === 'setLoginItemSettings') response = true
      else if (scope === 'app' && action === 'getVersion') response = '4.17.0-fixture'
      else response = { code: 0, data: [] }
      queueMicrotask(() => receive({}, channel, key, response))
    }
  }
</script>
<script type="module">
  import { createApp, h } from 'vue'
  import { createPinia } from 'pinia'
  import { AppStore } from '../render/store/app.ts'
  import { applyLanguagePayload } from '../lang/runtime.ts'
  import SettingsScreen from './screens/SettingsScreen.vue'
  import { useWorkspaceAppearance } from './state/workspaceAppearance.ts'
  import './styles/app.css'
  import './styles/settings-command.css'
  const messages = {}
  for (const [path, load] of Object.entries(import.meta.glob('../lang/en/*.json', { import: 'default' }))) {
    messages[path.split('/').pop().replace('.json', '')] = await load()
  }
  applyLanguagePayload({ locale: 'en', fallbackLocale: 'en', messages, fallbackMessages: messages })
  const pinia = createPinia()
  const store = AppStore(pinia)
  store.config.setup.lang = 'en'
  store.config.setup.theme = 'dark'
  store.config.setup.appFont = 'Arial'
  const app = createApp({ setup() {
    useWorkspaceAppearance()
    return () => h(SettingsScreen)
  } }).use(pinia)
  app.config.errorHandler = (error) => settingsErrors.push(error?.stack || String(error))
  app.mount('#app')
</script>`

const checks = String.raw`(async () => {
  const windows = location.search === '?windows'
  const text = (part) => document.body.innerText.includes(part)
  const wait = async (condition) => {
    for (let attempt = 0; attempt < 400; ++attempt) {
      if (settingsErrors.length) throw new Error(settingsErrors.join('\n'))
      if (condition()) return
      await new Promise((done) => setTimeout(done, 25))
    }
    throw new Error('Settings timed out: ' + document.body.innerText)
  }
  const section = (label) => {
    [...document.querySelectorAll('.settings-nav button')].find((item) => item.innerText.includes(label)).click()
  }
  const card = (label) => [...document.querySelectorAll('.settings-option')]
    .find((item) => item.innerText.includes(label))
  await wait(() => card('Tray Popup Style') && card('Server Proxy') && card('Auto Update'))
  if (windows) {
    await wait(() => card('Authorization Method'))
    card('Auto Launch At Boot').querySelector('.el-switch').click()
    await wait(() => preferences.some((setup) => setup.autoLaunch === true))
  } else if (card('Auto Launch At Boot') || card('Authorization Method')) {
    throw new Error('Platform-specific settings leaked into Linux')
  }
  const trayStyle = windows ? 'Classic' : 'Modern'
  const trayValue = trayStyle.toLowerCase()
  const trayOption = [...card('Tray Popup Style').querySelectorAll('label')]
    .find((option) => option.textContent.trim() === trayStyle)
  trayOption.click()
  await wait(() => preferences.some((setup) => setup.trayMenuBarStyle === trayValue))
  card('Auto Update').querySelector('.el-switch').click()
  await wait(() => preferences.some((setup) => setup.autoCheck === false))
  if (getComputedStyle(document.body).fontFamily.split(',')[0].replaceAll('"', '') !== 'Arial') {
    throw new Error('The saved UI font was not applied')
  }
  const theme = document.querySelector('#forge-theme')
  theme.value = 'light'
  theme.dispatchEvent(new Event('change', { bubbles: true }))
  await wait(() => preferences.some((setup) => setup.theme === 'light') && document.documentElement.classList.contains('light'))
  if (getComputedStyle(document.body).backgroundColor !== 'rgb(243, 247, 248)') throw new Error('The shell retained the dark palette')
  card('Start Hidden').querySelector('.el-switch').click()
  card('Start Services Automatically').querySelector('.el-switch').click()
  await wait(() => preferences.some((setup) => setup.autoHide === true && setup.autoStartService === true))
  if (!windows) return
  section('Editors')
  await wait(() => card('Editor Settings')?.querySelector('.monaco-editor'))
  const size = card('Editor Settings').querySelector('input[type=number]')
  size.value = '18'
  size.dispatchEvent(new Event('input', { bubbles: true }))
  await wait(() => preferences.some((setup) => setup.editorConfig?.fontSize === 18))
  section('Licenses')
  await wait(() => text('License not activated'))
  section('About PQT Forge')
  await wait(() => text('4.17.0-fixture'))
})()`

const startupHtml = String.raw`<!doctype html><div id="pqt-forge-app"></div>
<script>
  const fallback = location.search === '?fallback'
  const enabled = location.search !== '?disabled'
  const commandLog = window.commandLog = []
  const startupErrors = window.startupErrors = []
  window.addEventListener('error', (event) => startupErrors.push(event.message))
  window.addEventListener('unhandledrejection', (event) => startupErrors.push(event.reason?.stack || String(event.reason)))
  const bootstrap = window.bootstrap = { isWindows: true, isLinux: false, isMacOS: false, DataDirectoryReady: false,
    BaseDir: 'C:/fixture/', Static: 'C:/fixture/', AppDir: 'C:/fixture/', SetupDir: 'C:/fixture/' }
  let receive
  window.deliver = (command, ...values) => receive({}, command, command, ...values)
  window.QTEnvDevNodeAPI = {
    ipcReceiveFromMain(fn) { receive = fn },
    ipcSendToMain(command, key, ...args) {
      commandLog.push([command, ...args])
      const [scope, action] = args
      let response = { code: 0, data: [] }
      if (scope === 'app' && action === 'getConfig') response = {
        password: 'fixture-private-password', server: {}, setup: { lang: 'en', theme: 'dark', autoCheck: false, autoHide: enabled,
          autoStartService: enabled, common: { showItem: { apache: false, 'ftp-srv': false } }, hosts: { write: false }, editorConfig: {} }
      }
      else if (command === 'application:language-bootstrap') response = { code: 0, data: { payload: {
        locale: 'en', fallbackLocale: 'en', messages: {}, fallbackMessages: {}
      } } }
      else if (command === 'app-fork:version' && scope === 'allInstalledVersions') {
        const flag = action[0]
        const version = (number, enable) => ({ version: number, bin: 'C:/fixture/' + flag + '-' + number + '.exe',
          path: 'C:/fixture/' + flag + '-' + number, num: 1, enable, typeFlag: flag })
        response = flag === 'mysql' ? { code: 1, msg: 'Fixture discovery failed' } : { code: 0, data: {
          [flag]: flag === 'nginx' ? [version('0.1', false), version('1.2', true)] : flag === 'apache' ? [version('1.0', true)] : []
        } }
      }
      else if (command === 'app-fork:dns' && scope === 'workspaceStatus') {
        response = { code: 0, data: { running: false, address: '127.0.0.1', localIP: '127.0.0.1' } }
      }
      else if (command === 'app-fork:module-customer' && scope === 'stopService') {
        receive({}, command, key, { code: 200, data: 'Stopping' })
        window.finishTrayStop = () => receive({}, command, key, { code: 0 })
        return
      }
      else if ((command.endsWith(':module-customer') || command.endsWith(':nginx')) && scope === 'startService') {
        response = { code: 0, data: { 'APP-Service-Start-PID': 4242 } }
      }
      queueMicrotask(() => receive({}, command, key, response))
    }
  }
</script>
<script type="module">
  import localForage from 'localforage'
  const id = 'fixture-module'
  const command = { id: 'fixture-worker', name: 'Worker', commandType: 'command', command: 'echo fixture', comment: '' }
  await localForage.setItem('qtenvdev-customer-module', [{ id, typeFlag: id, label: 'Fixture', icon: '<svg />',
    item: [command], isService: true, isCustomer: true, moduleType: 'other', configPath: [], logPath: [] }])
  await localForage.setItem('qtenvdev-startup-groups', { data: { defaultStartupGroupId: fallback ? '' : 'default', groups: [
    { id: 'default', name: 'Default fixture', createdAt: 0, updatedAt: 0, items: [
      { id: 'member', type: 'service-version', module: 'custom-module:' + id, versionBin: command.name, versionPath: command.id }
    ] }
  ] } })
  try {
    await import('./next-main.ts')
    const { AppModules } = await import('../render/core/App.ts')
    const { AppStore } = await import('../render/store/app.ts')
    if (fallback) {
      AppModules.find((module) => module.typeFlag === 'redis').icon = new Promise((resolve) => { window.releaseTrayIcon = resolve })
      window.hideTrayIcon = () => { AppStore().config.setup.common.showItem.redis = false }
    }
    deliver('APP-Ready-To-Show', bootstrap)
  } catch (error) {
    startupErrors.push(error?.stack || String(error))
  }
</script>`

const startupChecks = String.raw`(async () => {
  const wait = async (condition) => {
    for (let attempt = 0; attempt < 1000; ++attempt) {
      if (startupErrors.length) throw new Error(startupErrors.join('\n'))
      if (condition()) return
      await new Promise((done) => setTimeout(done, 25))
    }
    throw new Error('Startup timed out: ' + document.body.innerText + ' ' + JSON.stringify(commandLog.map(([c]) => c)))
  }
  const fallback = location.search === '?fallback'
  const enabled = location.search !== '?disabled'
  const count = (channel) => commandLog.filter(([command]) => command === channel).length
  const starts = () => commandLog.filter(([command, action]) => command.endsWith(':module-customer') && action === 'startService')
  const lastSnapshot = () => commandLog.filter(([command]) => command === 'APP:Tray-Store-Sync').at(-1)?.[1]
  const service = (id) => lastSnapshot()?.service.find((item) => item.id === id)
  const trayCommand = (action, id) => deliver('APP:Tray-Command', action, id)
  await wait(() => count('application:renderer-initialized') === 1)
  if (count('APP:Auto-Hide') !== Number(enabled) || starts().length) throw new Error('Startup settings ran before data was ready')
  await wait(() => lastSnapshot()?.groupDisabled === true && count('Application:tray-status-change') === 1)
  if (lastSnapshot().password) throw new Error('The tray received the application password')
  deliver('APP-Data-Directory-Ready', true)
  deliver('APP-Data-Directory-Ready', true)
  deliver('APP-Ready-To-Show', bootstrap)
  if (enabled) {
    await wait(() => starts().length > 0 && document.body.innerText.includes(fallback ? 'MySQL: service availability could not be verified' : 'Default fixture: started'))
  } else {
    await new Promise((done) => setTimeout(done, 150))
  }
  if (count('application:renderer-initialized') !== 1 || count('APP:Auto-Hide') !== Number(enabled) || starts().length !== Number(enabled)) {
    throw new Error('Startup ran more than once or ignored its opt-in')
  }
  if (enabled && starts()[0][0] !== 'app-fork-background:module-customer') throw new Error('Auto-start attempted an interactive launch')
  if (fallback) {
    hideTrayIcon()
    await wait(() => lastSnapshot()?.groupIsRunning && service('nginx')?.run && service('dns')?.disabled === false)
    const nginxStart = commandLog.filter(([command, action]) => command.endsWith(':nginx') && action === 'startService')
    if (nginxStart.length !== 1 || nginxStart[0][0] !== 'app-fork-background:nginx' || nginxStart[0][2].version !== '1.2') {
      throw new Error('Fallback missed the enabled installed version or used interactive startup')
    }
    if (!service('mysql')?.disabled || service('apache') || service('redis') || service('dns').run) {
      throw new Error('Fallback did not preserve confirmed, visible tray state')
    }
    if (commandLog.some(([channel, action]) => channel.endsWith(':apache') || channel.endsWith(':mysql') || (channel.endsWith(':dns') && action === 'startService'))) {
      throw new Error('Fallback attempted to start a hidden, unverified, or DNS service')
    }
    releaseTrayIcon({ default: '<svg />' })
    await new Promise((done) => setTimeout(done, 50))
    if (service('redis')) throw new Error('A stale snapshot was published after its icon resolved')
    trayCommand('switchChange', 'apache')
    await new Promise((done) => setTimeout(done, 20))
    if (commandLog.some(([channel]) => channel.endsWith(':apache'))) throw new Error('Tray targeted a hidden service')
    trayCommand('groupDo')
    await wait(() => typeof finishTrayStop === 'function')
    trayCommand('groupDo')
    finishTrayStop()
    await wait(() => !service('nginx')?.run && !service('fixture-module')?.run && !lastSnapshot()?.groupDisabled)
    if (count('app-fork:module-customer') !== 1 || count('app-fork:nginx') !== 1) throw new Error('Fallback stop was submitted multiple times')
  } else if (enabled) {
    await wait(() => lastSnapshot()?.startupGroups[0]?.run && !lastSnapshot()?.groupDisabled)
    trayCommand('startupGroupDo', 'default')
    await wait(() => typeof finishTrayStop === 'function' && lastSnapshot()?.startupGroups[0]?.disabled)
    trayCommand('startupGroupDo', 'default')
    finishTrayStop()
    await wait(() => lastSnapshot()?.startupGroups[0]?.run === false && !lastSnapshot()?.groupDisabled)
    if (count('app-fork:module-customer') !== 1) throw new Error('The named group stop was submitted multiple times')
    trayCommand('switchChange', 'fixture-module')
    await wait(() => service('fixture-module')?.run && lastSnapshot()?.startupGroups[0]?.run)
    if (starts().length !== 2 || starts()[1][0] !== 'app-fork:module-customer') throw new Error('The tray did not dispatch the custom service switch')
  }
})()`

try {
  await writeFile(fixture, fixtureHtml)
  await writeFile(startupFixture, startupHtml)
  await server.listen()
  const address = server.httpServer?.address()
  assert(address && typeof address !== 'string')
  const url = `http://127.0.0.1:${address.port}/render-next/${fixtureName}`
  const startupUrl = `http://127.0.0.1:${address.port}/render-next/${startupFixtureName}`
  const entry = join(directory, 'main.cjs')
  await writeFile(entry, `const { app, BrowserWindow } = require('electron')
app.setPath('userData', ${JSON.stringify(join(directory, 'profile'))})
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1200, height: 800, webPreferences: { backgroundThrottling: false } })
  for (const platform of ['windows', 'linux']) {
    await win.loadURL(${JSON.stringify(url)} + '?' + platform)
    await win.webContents.executeJavaScript(${JSON.stringify(checks)})
  }
  for (const mode of ['disabled', 'enabled', 'fallback']) {
    await win.loadURL(${JSON.stringify(startupUrl)} + '?' + mode)
    await win.webContents.executeJavaScript(${JSON.stringify(startupChecks)})
  }
  app.exit(0)
}).catch((error) => { console.error(error); app.exit(1) })
setTimeout(() => app.exit(2), 90000)`)
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const code = await new Promise<number | null>((resolve, reject) => {
    const child = spawn(String(electron), [entry], { env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('close', resolve)
  })
  assert.equal(code, 0)
  console.log('PQT Forge settings Electron UI passed: platform gating, preferences, editor preview, system tray commands and background startup.')
} finally {
  await server.close()
  await rm(fixture, { force: true })
  await rm(startupFixture, { force: true })
  await rm(directory, { recursive: true, force: true })
}
