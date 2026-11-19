import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electron from 'electron'
import { createServer } from 'vite'
import viteConfig from '../configs/vite.config'

// Run the Package Library and language workflow entry points with isolated IPC.
const directory = await mkdtemp(join(tmpdir(), 'pqt-homebrew-ui-'))
const fixtureName = '.homebrew-ui-' + process.pid + '.html'
const fixture = resolve('src/render-next', fixtureName)
const server = await createServer({
  ...viteConfig.serverConfig,
  configFile: false,
  server: { port: 0, host: '127.0.0.1' }
})
const bootstrap = String.raw`
const bootstrapCase = location.search === '?bootstrap'
const mac = location.search === '?mac' || bootstrapCase
window.Server = {
  isMacOS: mac, isWindows: !mac, BaseDir: '/fixture/', AppDir: '/fixture/',
  Static: "/Applications/Env's Dev.app/Contents/Resources/app.asar/dist/electron/static",
  BrewBin: mac && !bootstrapCase ? '/opt/homebrew/bin/brew' : '',
  BrewCellar: mac && !bootstrapCase ? '/opt/homebrew/Cellar' : ''
}
const formula = 'homebrew/core/php'
let installed = false, current = '8.4', tapEnabled = false, receive
window.calls = []
window.QTEnvDevNodeAPI = {
  ipcReceiveFromMain(fn) { receive = fn },
  ipcSendToMain(channel, key, ...args) {
    const [action, first, second] = args
    calls.push([channel, ...args])
    const send = (message) => queueMicrotask(() => receive({}, channel, key, message))
    const success = (data = []) => send({ code: 0, data })
    if (channel === 'NodePty:init') {
      window.finishPtyInit = (ok) => {
        window.finishPtyInit = undefined
        if (ok) success('fixture-pty')
        else send({ code: 1, msg: 'Terminal runtime failed to open' })
      }
    } else if (channel === 'NodePty:exec') {
      if (action !== 'fixture-pty' || args[2] !== 'direct' || args[3] !== true ||
          first.length !== 1 || !first[0].includes("Env's Dev".replace("'", "'\\''")) ||
          !first[0].endsWith("/app.asar.unpacked/dist/electron/static/sh/brew-install-en.sh'")) {
        throw new Error('Incorrect installer command ' + JSON.stringify(args))
      }
      queueMicrotask(() => receive({}, 'NodePty:data:fixture-pty', 'NodePty:data:fixture-pty', 'Fixture installer prompt'))
      window.finishPtyExec = (exitCode) => {
        window.finishPtyExec = undefined
        if (exitCode === 0) success({ exitCode })
        else send({ code: 1, data: { exitCode }, msg: 'Terminal exited with code ' + exitCode })
      }
    } else if (channel === 'NodePty:stop') {
      if (action !== 'fixture-pty') throw new Error('Stopped the wrong PTY')
      window.finishPtyExec = undefined
      success()
    } else if (channel === 'App-Node-FN' && action === 'nativeTheme') {
      send(true)
    } else if (channel === 'app-refresh-macos-homebrew') {
      window.finishDiscovery = (ok) => {
        window.finishDiscovery = undefined
        if (ok) success({ bin: '/opt/homebrew/bin/brew', cellar: '/opt/homebrew/Cellar' })
        else send({ code: 1, msg: 'Homebrew detection unavailable' })
      }
    } else if (channel === 'app-fork:language-project' && action === 'startService') {
      send({ code: 200, msg: 'Fixture project starting' })
      window.finishProjectStart = () => success({ 'APP-Service-Start-PID': '41730' })
    } else if (channel === 'app-fork:language-project' && action === 'stopService') {
      if (first !== '41730' || second !== 'node') throw new Error('Wrong project PID or kind')
      success(true)
    } else if (channel === 'app-fork:php' && action === 'brewinfo') {
      success([{ name: formula, version: '8.5', installed }])
    } else if (channel === 'app-fork:typesense' && action === 'brewinfo') {
      if (tapEnabled) success([{ name: 'typesense/tap/typesense-server', version: '30', installed: false }])
      else send({ code: 1, msg: 'Typesense tap is missing' })
    } else if (channel === 'app-fork:brew') {
      const snapshot = {
        formula, installedVersions: [current], availableVersion: '8.5',
        outdated: installed && current !== '8.5', eligible: installed && current !== '8.5'
      }
      if (action === 'addTap' && first === 'typesense/homebrew-tap') {
        tapEnabled = true
        success(2)
      } else if (action === 'getUpgradeCatalog') success({ rows: [snapshot], failures: [] })
      else if (action === 'prepareUpgrade') success({ previewId: 'preview', module: 'php', targets: [], snapshot })
      else if (action === 'beginUpgrade') success({ operationId: 'upgrade', targets: [] })
      else if (action === 'packageOperation' || action === 'executeUpgrade') {
        const verb = action === 'executeUpgrade' ? 'upgrade' : first
        if (action === 'packageOperation' && second !== formula) throw new Error('Wrong formula')
        send({ code: 200, msg: 'Fixture progress' })
        window.finishHomebrew = () => {
          if (verb === 'upgrade') current = '8.5'
          else installed = verb === 'install'
          success({ operationId: verb, action: verb, outcome: 'succeeded', logs: 'Fixture completed' })
          window.finishHomebrew = undefined
        }
      } else success()
    } else success()
  }
}
`
const checks = String.raw`(async () => {
  const mac = location.search === '?mac'
  const button = (label) => [...document.querySelectorAll('button')]
    .find((element) => element.textContent.trim() === label || element.getAttribute('aria-label') === label)
  const wait = async (check) => {
    for (let attempt = 0; attempt < 480; ++attempt) {
      if (check()) return
      await new Promise((done) => setTimeout(done, 25))
    }
    throw new Error('Timed out: ' + document.body.innerText + '\n' + JSON.stringify(calls))
  }
  const click = async (label) => {
    await wait(() => button(label) && !button(label).disabled)
    button(label).click()
  }
  const called = (action) => calls.filter(([, method]) => method === action).length
  const contains = (value) => document.body.innerText.includes(value)
  await click('Manage packages')
  await wait(() => contains('No direct-download versions'))
  if (called('brewinfo')) throw new Error('Direct source queried Homebrew')
  if (!mac) {
    if (button('Homebrew') || button('Install Homebrew') || called('NodePty:init')) {
      throw new Error('Homebrew is visible on Windows')
    }
    return
  }
  await click('Homebrew')
  await wait(() => called('brewinfo') === 1)
  const first = calls.find(([, action]) => action === 'brewinfo')
  if (first[0] !== 'app-fork:php' || first[2] !== 'php') throw new Error('Wrong catalog request')
  await click('Install')
  await wait(() => contains('Homebrew is working…'))
  await click('Close package library')
  await click('Manage packages')
  await wait(() => contains('Homebrew is working…'))
  if (called('packageOperation') !== 1) throw new Error('Reopening repeated the install')
  window.finishHomebrew()
  await click('Upgrade')
  await wait(() => contains('8.4 → 8.5'))
  if (called('beginUpgrade')) throw new Error('Upgrade started without confirmation')
  await click('Confirm upgrade')
  await wait(() => called('executeUpgrade') === 1 && window.finishHomebrew)
  window.finishHomebrew()
  await click('Uninstall')
  await wait(() => contains('Uninstall homebrew/core/php with Homebrew?'))
  if (called('packageOperation') !== 1) throw new Error('Uninstall started without confirmation')
  await click('Confirm uninstall')
  await wait(() => called('packageOperation') === 2 && window.finishHomebrew)
  window.finishHomebrew()
  await wait(() => contains('Homebrew operation completed.') && button('Install') && !button('Install').disabled)
  const packageSelect = document.querySelector('.package-toolbar select')
  packageSelect.value = 'typesense'
  packageSelect.dispatchEvent(new Event('change', { bubbles: true }))
  await wait(() => contains('Typesense tap is missing'))
  await click('Enable tap')
  await wait(() => contains('typesense/tap/typesense-server'))
  if (called('addTap') !== 1 || contains('Typesense tap is missing')) throw new Error('Tap did not recover its catalog')
})()`
const bootstrapChecks = String.raw`(async () => {
  const button = (label) => [...document.querySelectorAll('button')]
    .find((element) => element.textContent.trim() === label || element.getAttribute('aria-label') === label)
  const contains = (value) => document.body.innerText.includes(value)
  const called = (channel) => calls.filter(([route]) => route === channel).length
  const wait = async (check) => {
    for (let attempt = 0; attempt < 480; ++attempt) {
      if (check()) return
      if (window.projectErrors?.length) throw new Error(window.projectErrors.join('\n'))
      await new Promise((done) => setTimeout(done, 25))
    }
    throw new Error('Timed out: ' + document.body.innerText + '\n' + JSON.stringify(calls))
  }
  const click = async (label) => {
    await wait(() => button(label) && !button(label).disabled)
    button(label).click()
  }
  await click('Manage packages')
  await click('Homebrew')
  await wait(() => button('Install Homebrew'))
  button('Install Homebrew').click()
  button('Install Homebrew').click()
  await wait(() => window.finishPtyInit)
  await click('Close package library')
  await click('Manage packages')
  await wait(() => contains('Opening the Homebrew installer'))
  if (called('NodePty:init') !== 1) throw new Error('Reopening initialized a second terminal')
  window.finishPtyInit(false)
  await wait(() => contains('Terminal runtime failed to open'))

  await click('Install Homebrew')
  await wait(() => window.finishPtyInit)
  await click('Cancel installation')
  await wait(() => contains('Stopping the Homebrew installer'))
  window.finishPtyInit(true)
  await wait(() => contains('Homebrew installation cancelled.'))
  if (called('NodePty:exec') || called('NodePty:stop') !== 1) {
    throw new Error('Cancellation during setup did not stop the unused terminal')
  }

  await click('Install Homebrew')
  await wait(() => window.finishPtyInit)
  window.finishPtyInit(true)
  await wait(() => window.finishPtyExec && document.querySelector('.brew-terminal .xterm'))
  window.finishPtyExec(77)
  await wait(() => contains('Terminal exited with code 77'))
  if (window.terminalHasOutputListener()) throw new Error('Failed terminal kept its output listener')
  if (called('app-refresh-macos-homebrew')) throw new Error('Installer failure was treated as success')

  await click('Install Homebrew')
  await wait(() => window.finishPtyInit)
  window.finishPtyInit(true)
  await wait(() => window.finishPtyExec && document.querySelector('.brew-terminal .xterm'))
  await click('Close package library')
  await click('Manage packages')
  await wait(() => contains('Homebrew installation is running.') && document.querySelector('.brew-terminal .xterm'))
  if (called('NodePty:init') !== 4 || called('NodePty:exec') !== 2) {
    throw new Error('Reopening repeated the running installer')
  }
  window.finishPtyExec(0)
  await wait(() => window.finishDiscovery && contains('Checking for Homebrew'))
  if (window.terminalHasOutputListener()) throw new Error('Installer kept its terminal listener after exit')
  window.finishDiscovery(false)
  await wait(() => contains('The installer completed.') && contains('Homebrew detection unavailable'))
  await click('Check for Homebrew again')
  await wait(() => window.finishDiscovery)
  window.finishDiscovery(true)
  await wait(() => contains('Homebrew is available.') && contains('homebrew/core/php'))
  if (called('NodePty:exec') !== 2 || called('app-refresh-macos-homebrew') !== 2) {
    throw new Error('Discovery recovery repeated the installer')
  }
})()`
const projectChecks = String.raw`(async () => {
  const button = (label) => [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === label)
  const wait = async (check) => {
    for (let attempt = 0; attempt < 480; ++attempt) {
      if (check()) return
      if (window.projectErrors?.length) throw new Error(window.projectErrors.join('\n'))
      await new Promise((done) => setTimeout(done, 25))
    }
    throw new Error('Timed out: ' + document.body.innerText.slice(0, 650))
  }
  const nodeRow = () => [...document.querySelectorAll('.workflow-row')].find((row) => row.innerText.includes('Saved Node fixture'))
  await wait(() => nodeRow())
  const start = [...nodeRow().querySelectorAll('button')].find((item) => item.textContent.trim() === 'Start')
  start.click()
  await wait(() => window.finishProjectStart && nodeRow().innerText.includes('Working'))
  window.finishProjectStart()
  await wait(() => nodeRow().innerText.includes('Running'))
  button('Refresh').click()
  await wait(() => button('Refresh') && !button('Refresh').disabled)
  if (!nodeRow().innerText.includes('Running')) throw new Error('Refresh discarded live project state')
  const stop = [...nodeRow().querySelectorAll('button')].find((item) => item.textContent.trim() === 'Stop')
  stop.click()
  await wait(() => nodeRow().innerText.includes('Stopped'))
  const projectCalls = calls.filter((call) => call[0] === 'app-fork:language-project')
  if (projectCalls.length !== 2 || projectCalls[0][2].runCommand !== 'npm run dev' || projectCalls[0][2].projectPort !== 4173 || projectCalls[0][2].additionalProjectPorts[0] !== 5173) throw new Error('Project lifecycle did not send saved command and ports')
  await wait(() => button('Manage projects'))
  button('Manage projects').click()
  await wait(() => document.querySelector('.project-manager-controls select'))
  const language = document.querySelector('.project-manager-controls select')
  for (const [kind, label] of [['php', 'PHP'], ['node', 'Node'], ['python', 'Python'], ['golang', 'Go']]) {
    button('Saved projects').click()
    language.value = kind
    language.dispatchEvent(new Event('change', { bubbles: true }))
    await wait(() => document.querySelector('.pqt-established-tool .el-table')?.innerText.includes('Saved ' + label + ' fixture'))
    button('Create from template').click()
    const tile = () => document.querySelector('.pqt-language-project-surface .el-collapse-item .group')
    await wait(() => tile())
    tile().click()
    const dialog = () => document.querySelector('.pqt-established-detached-tool .el-dialog, .pqt-established-detached-tool .el-drawer')
    await wait(() => dialog()?.querySelector('input'))
    await wait(() => dialog().getBoundingClientRect().height > 80)
    dialog().querySelector('.el-dialog__headerbtn, .el-drawer__close-btn').click()
    await wait(() => !dialog())
  }
  if (window.projectErrors.length) throw new Error(window.projectErrors.join('\n'))
})()`

try {
  await writeFile(
    fixture,
    `<!doctype html><div id="app"></div><script>${bootstrap}</script>
<script type="module">
  import { createApp, h, reactive } from 'vue'
  import { createPinia } from 'pinia'
  import IPC from '../render/util/IPC.ts'
  import PackageBrowser from './components/PackageBrowser.vue'
  import './styles/app.css'
  import './styles/websites.css'
  window.Server = reactive(window.Server)
  window.terminalHasOutputListener = () => !!IPC.listens['NodePty:data:fixture-pty']
  let component = PackageBrowser
  if (location.search === '?projects') {
    const { default: localForage } = await import('localforage')
    const { applyLanguagePayload } = await import('../lang/runtime.ts')
    const messages = {}
    for (const [path, load] of Object.entries(import.meta.glob('../lang/en/*.json', { import: 'default' }))) {
      messages[path.split('/').pop().replace('.json', '')] = await load()
    }
    applyLanguagePayload({ locale: 'en', fallbackLocale: 'en', messages, fallbackMessages: messages })
    for (const [kind, label] of [['php', 'PHP'], ['node', 'Node'], ['python', 'Python'], ['golang', 'Go']]) {
      await localForage.setItem('qtenvdev-' + kind + '-projects', [{
        id: 'saved-' + kind, typeFlag: kind, path: 'C:/fixture/' + kind + '-project',
        comment: 'Saved ' + label + ' fixture', runCommand: 'npm run dev', projectPort: 4173,
        additionalProjectPorts: [5173], isService: true, binVersion: ''
      }])
    }
    component = (await import('./components/ProjectWorkflowPanel.vue')).default
  }
  window.projectErrors ??= []
  window.addEventListener('unhandledrejection', event => projectErrors.push(String(event.reason)))
  const app = createApp({ render: () => h(component, component === PackageBrowser ? { flag: 'php' } : undefined) }).use(createPinia())
  app.config.errorHandler = (error) => projectErrors.push(error?.stack || String(error))
  app.mount('#app')
</script>`
  )
  await server.listen()
  const address = server.httpServer?.address()
  assert(address && typeof address !== 'string')
  const url = `http://127.0.0.1:${address.port}/render-next/${fixtureName}`
  const entry = join(directory, 'main.cjs')
  await writeFile(
    entry,
    `const { app, BrowserWindow } = require('electron')
app.setPath('userData', ${JSON.stringify(join(directory, 'profile'))})
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1200, height: 800, webPreferences: { backgroundThrottling: false } })
  win.webContents.on('console-message', (event) => {
    if (event.level === 'error' || event.level === 'warning') console.error(event.message)
  })
  for (const query of ['?mac', '?windows']) {
    await win.loadURL(${JSON.stringify(url)} + query)
    await win.webContents.executeJavaScript(${JSON.stringify(checks)})
  }
  await win.loadURL(${JSON.stringify(url)} + '?bootstrap')
  await win.webContents.executeJavaScript(${JSON.stringify(bootstrapChecks)})
  await win.loadURL(${JSON.stringify(url)} + '?projects')
  await win.webContents.executeJavaScript(${JSON.stringify(projectChecks)})
  app.exit(0)
}).catch((error) => { console.error(error); app.exit(1) })
setTimeout(() => app.exit(2), 60000)`
  )
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const result = await new Promise<{ code: number | null; output: string }>((done, reject) => {
    const child = spawn(String(electron), [entry], { env, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (data) => {
      output += data
    })
    child.stderr.on('data', (data) => {
      output += data
    })
    child.once('error', reject)
    child.once('close', (code) => done({ code, output }))
  })
  assert.equal(result.code, 0, result.output)
  console.log(
    'Homebrew Electron UI passed: source routing, bootstrap setup/exit failures, cancellation, progress across reopen, discovery retry, package lifecycle, tap recovery and Windows gating.'
  )
  console.log(
    'Language projects Electron UI passed: PHP, Node.js, Python and Go saved projects and first-click scaffold forms; start progress, live PID retention across refresh, and stop through fixture IPC.'
  )
} finally {
  await server.close()
  await rm(fixture, { force: true })
  await rm(directory, { recursive: true, force: true })
}
