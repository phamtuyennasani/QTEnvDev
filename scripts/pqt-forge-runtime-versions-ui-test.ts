import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import electron from 'electron'
import { createServer } from 'vite'
import viteConfig from '../configs/vite.config'

const directory = await mkdtemp(join(tmpdir(), 'pqt-runtime-versions-'))
const filename = `.runtime-versions-ui-${process.pid}.html`
const fixture = resolve('src/render-next', filename)
const server = await createServer({
  ...viteConfig.serverConfig,
  configFile: false,
  server: { port: 0, host: '127.0.0.1', hmr: false }
})

const setup = String.raw`
window.Server = { isLinux: true, DataDirectoryReady: true, BaseDir: '/fixture/', AppDir: '/fixture/' }
window.errors = []
window.addEventListener('error', (event) => errors.push(event.error?.stack || event.message))
window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)))
const python = (version, path) => ({
  typeFlag: 'python', version, path, num: Number(version.split('.').slice(0, 2).join('')),
  bin: path + '/bin/python3', enable: true, run: false, running: false
})
const pythonVersions = [python('3.12.9', '/fixture/python312'), python('3.13.2', '/fixture/python313')]
const folder = '/fixture/python-custom'
window.pathWrites = []
window.scans = []
window.flutterCommands = []
window.flutterCreates = []
window.flutterEdits = []
window.doctorRequests = 0
let receive
window.QTEnvDevNodeAPI = {
  ipcReceiveFromMain(fn) { receive = fn },
  ipcSendToMain(channel, key, action, ...args) {
    const send = (response) => queueMicrotask(() => receive({}, channel, key, response))
    const reply = (data) => send({ code: 0, data })
    if (action === 'allInstalledVersions') {
      const [flags, setup] = args
      const dirs = setup.python?.dirs ?? []
      if (flags.includes('python')) scans.push(dirs)
      const versions = dirs.includes(folder) ? [...pythonVersions, python('3.14.0', folder)] : pythonVersions
      reply(Object.fromEntries(flags.map((flag) => [flag, flag === 'python' ? versions : []])))
    } else if (action === 'fetchPATH') {
      reply({ appPath: [], allPath: [] })
    } else if (action === 'updatePATH') {
      pathWrites.push(args)
      finishPathWrite = () => reply({ appPath: [args[0].path], allPath: [args[0].path + '/bin'] })
    } else if (action === 'flutterSdkInfo') {
      reply({ flutterVersion: '3.35.1', dartVersion: '3.9.0', channel: 'stable', flutterBin: '/fixture/flutter/bin/flutter', searchDirs: [] })
    } else if (action === 'flutterDoctor') {
      doctorRequests += 1
      window.finishDoctor = () => reply({ flutterBin: '/fixture/flutter/bin/flutter', items: [{ status: 'ok', title: 'Flutter doctor fixture' }], summary: { total: 1, ok: 1, warning: 0, error: 0 } })
    } else if (action === 'androidReadiness') {
      reply({ env: { ANDROID_HOME: '/fixture/android/sdk' }, checks: [{ key: 'sdk', label: 'Android SDK', ok: true, value: '/fixture/android/sdk', hint: '' }], summary: { passed: 1, total: 1 } })
    } else if (action === 'androidDevices') {
      reply({ adbPath: '/fixture/android/sdk/platform-tools/adb', devices: [{ id: 'flutter-emulator-fixture', status: 'device', meta: 'test' }], summary: { total: 1, online: 1 } })
    } else if (action === 'flutterAdvancedAction') {
      flutterCommands.push(args[0])
      send({ code: 200, msg: 'Running Flutter command' })
      window.finishFlutterCommand = () => reply({ ok: true, message: 'Flutter command fixture finished' })
    } else if (action === 'flutterCreateProject') {
      flutterCreates.push(args)
      send({ code: 200, msg: 'Creating Flutter project' })
      window.finishFlutterCreate = () => reply({ ok: true, projectPath: '/fixture/python-custom/flutter_fixture' })
    } else if (action === 'flutterReadProjectConfig') {
      reply({ ok: true, projectName: 'flutter_fixture', orgName: 'com.example' })
    } else if (action === 'flutterApplyProjectConfig') {
      flutterEdits.push(args)
      reply({ ok: true })
    } else if (action === 'dialog' && args[0] === 'showOpenDialog') {
      send({ canceled: false, filePaths: [folder] })
    } else {
      reply(null)
    }
  }
}
window.finishPathWrite = undefined
`

const checks = String.raw`(async () => {
  const wait = async (predicate, label) => {
    for (let attempt = 0; attempt < 300; ++attempt) {
      if (errors.length) throw new Error(errors.join('\n'))
      const found = predicate()
      if (found) return found
      await new Promise((done) => setTimeout(done, 25))
    }
    throw new Error(label + ': ' + document.body.innerText.slice(-1500))
  }
  const python = () => [...document.querySelectorAll('.runtime-item')].find((row) => row.querySelector('b')?.textContent === 'Python')
  const summary = () => document.querySelector('.runtime-detail-panel .detail-kind')?.textContent
  const versions = () => document.querySelector('.installed-versions-surface')
  const row = (version) => [...(versions()?.querySelectorAll('.el-table__row') ?? [])]
    .find((item) => item.querySelector('.truncate')?.textContent.trim() === version)
  const showVersions = async () => {
    const launch = await wait(() => [...document.querySelectorAll('.runtime-detail-panel button')]
      .find((button) => button.textContent.trim() === 'Installed versions'), 'Installed versions button')
    launch.click()
    await wait(() => row('3.13.2'), 'discovered Python versions')
  }
  const closeVersions = () => document.querySelector('.forge-close').click()
  ;(await wait(() => python()?.textContent.includes('3.12.9') && python(), 'detected Python')).click()
  await showVersions()
  if (versions().querySelector('.status.start')) throw new Error('Python has service lifecycle controls')
  ;(await wait(() => row('3.13.2')?.querySelector('.current-set'), 'set PATH')).click()
  await wait(() => row('3.13.2')?.querySelector('.is-loading'), 'PATH write in progress')
  if (pathWrites.length !== 1 || pathWrites[0][0].bin !== '/fixture/python313/bin/python3' || pathWrites[0][1] !== 'python') {
    throw new Error('PATH write did not use the selected Python binary')
  }
  closeVersions()
  if (!summary()?.includes('3.12.9')) throw new Error('Runtime summary changed before the terminal reply')
  await showVersions()
  await wait(() => row('3.13.2')?.querySelector('.is-loading'), 'PATH write survived dialog close')
  if (pathWrites.length !== 1) throw new Error('Opening replayed the PATH write')
  finishPathWrite()
  await wait(() => row('3.13.2')?.querySelector('.truncate.current'), 'selected Python version')
  await wait(() => summary()?.includes('3.13.2'), 'updated runtime summary')

  versions().querySelector('.card-header .left button').click()
  ;(await wait(() => document.querySelector('.custom-path .add'), 'discovery folder dialog'))
    .dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await wait(() => document.querySelector('.custom-path input')?.value === '/fixture/python-custom', 'added folder')
  document.querySelector('.custom-path .el-dialog__headerbtn').click()
  await wait(() => scans.some((dirs) => dirs.includes('/fixture/python-custom')) && row('3.14.0'), 'custom folder rescanned')
  closeVersions()
  await showVersions()
  if (!row('3.14.0')) throw new Error('Discovered custom Python disappeared after reopening')
  closeVersions()

  const java = await wait(() => [...document.querySelectorAll('.runtime-item')].find((row) =>
    row.querySelector('b')?.textContent === 'Java' && row.querySelector('.runtime-projects')?.textContent === '1'
  ), 'Java saved project count')
  java.click()
  ;(await wait(() => [...document.querySelectorAll('.runtime-detail-panel button')]
    .find((button) => button.textContent.trim() === 'Manage projects'), 'Runtime project launcher')).click()
  await wait(() => document.querySelector('.project-manager-controls select')?.value === 'java', 'Java project manager')
  await wait(() => document.querySelector('[data-project-id="java-project"]'), 'Java project from existing storage')
  closeVersions()

  const button = (label, selector = 'button') => [...document.querySelectorAll(selector)]
    .find((item) => item.textContent.trim() === label && !item.disabled)
  const click = async (label, selector) => (await wait(() => button(label, selector), label)).click()
  const flutter = await wait(() => [...document.querySelectorAll('.runtime-item')]
    .find((item) => item.querySelector('b')?.textContent === 'Flutter'), 'Flutter row')
  flutter.click()
  await click('Flutter tools')
  await wait(() => document.querySelector('.flutter-general')?.textContent.includes('3.35.1'), 'Flutter SDK details')
  await click('List channels')
  await wait(() => flutterCommands.length === 1 && document.querySelector('.flutter-general .is-loading'), 'Flutter command in progress')
  await click('Android', '.flutter-tool-tabs button')
  await wait(() => document.querySelector('.flutter-tool-surface')?.textContent.includes('flutter-emulator-fixture'), 'detected Android device')
  if (doctorRequests !== 1) throw new Error('Switching Flutter tabs duplicated the pending doctor request')
  finishDoctor()
  finishFlutterCommand()
  await click('General', '.flutter-tool-tabs button')
  await wait(() => document.querySelector('.flutter-general pre')?.textContent.includes('Flutter command fixture finished'), 'Flutter command output after switching tabs')
  if (flutterCommands[0] !== 'channel-list') throw new Error('Flutter command did not use the intended action')
  closeVersions()
  await click('Manage projects', '.runtime-detail-panel button')
  await click('New Project', '.flutter-projects button')
  const name = await wait(() => document.querySelector('input[placeholder="my_flutter_app"]'), 'Flutter create project form')
  name.value = 'flutter_fixture'
  name.dispatchEvent(new Event('input', { bubbles: true }))
  document.querySelector('.host-edit-drawer .icon-block').click()
  await click('Create', '.host-edit-drawer button')
  await wait(() => flutterCreates.length === 1 && document.querySelector('.host-edit-drawer .is-loading'), 'Flutter create progress')
  if (flutterCreates[0][0] !== 'flutter_fixture' || flutterCreates[0][1] !== '/fixture/python-custom') {
    throw new Error('Flutter create did not snapshot the selected name and output folder')
  }
  finishFlutterCreate()
  const created = await wait(() => [...document.querySelectorAll('.flutter-projects [data-project-id]')].find((item) =>
    item.textContent.includes('/fixture/python-custom/flutter_fixture')), 'created Flutter project in saved list')
  await wait(() => !document.querySelector('.host-edit-drawer input[placeholder="my_flutter_app"]'), 'create drawer closed')
  const actions = created.closest('tr').querySelector('button[aria-label="Action"]')
  if (!actions) throw new Error('Could not find the Flutter project actions button')
  actions.dispatchEvent(new MouseEvent('mouseenter'))
  actions.focus()
  const edit = await wait(() => [...document.querySelectorAll('.host-list-menu li')]
    .find((item) => item.textContent.trim() === 'Edit (Flutter)'), 'Flutter edit action')
  edit.click()
  const projectName = await wait(() => [...document.querySelectorAll('input[placeholder="my_flutter_app"]')]
    .find((item) => item.value === 'flutter_fixture'), 'Flutter project settings hydrated')
  projectName.value = 'flutter_renamed'
  projectName.dispatchEvent(new Event('input', { bubbles: true }))
  await click('Save', '.host-edit-drawer button')
  await wait(() => flutterEdits.length === 1, 'Flutter project settings applied')
  if (flutterEdits[0][0] !== '/fixture/python-custom/flutter_fixture' || flutterEdits[0][1].projectName !== 'flutter_renamed') {
    throw new Error('Flutter settings were written to the wrong project or with the wrong form values')
  }
})()`

try {
  await writeFile(
    fixture,
    `<!doctype html><div id="app"></div><script>${setup}</script>
<script type="module">
  import { createApp } from 'vue'
  import { createPinia, setActivePinia } from 'pinia'
  import localForage from 'localforage'
  import { applyLanguagePayload } from '../lang/runtime.ts'
  import './styles/app.css'
  const messages = {}
  for (const [path, load] of Object.entries(import.meta.glob('../lang/en/*.json', { import: 'default' }))) {
    messages[path.split('/').pop().replace('.json', '')] = await load()
  }
  applyLanguagePayload({ locale: 'en', fallbackLocale: 'en', messages, fallbackMessages: messages })
  const pinia = createPinia()
  setActivePinia(pinia)
  const { default: Runtimes } = await import('./screens/RuntimesScreen.vue')
  await localForage.setItem('qtenvdev-java-projects', [
    { id: 'java-project', path: '/fixture/Java project', comment: 'Java project from the existing project list' }
  ])
  const app = createApp(Runtimes).use(pinia)
  app.config.errorHandler = (error) => errors.push(error?.stack || String(error))
  app.mount('#app')
</script>`
  )
  await server.listen()
  const address = server.httpServer?.address()
  assert(address && typeof address !== 'string')
  const url = `http://127.0.0.1:${address.port}/render-next/${filename}`
  const entry = join(directory, 'main.cjs')
  await writeFile(
    entry,
    `const { app, BrowserWindow } = require('electron')
app.setPath('userData', ${JSON.stringify(join(directory, 'profile'))})
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1200, height: 800, webPreferences: { backgroundThrottling: false } })
  await window.loadURL(${JSON.stringify(url)})
  await window.webContents.executeJavaScript(${JSON.stringify(checks)})
  app.exit(0)
}).catch((error) => { console.error(error); app.exit(1) })
setTimeout(() => app.exit(2), 45000)`
  )
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const result = await new Promise<{ code: number | null; output: string }>((done, reject) => {
    const child = spawn(String(electron), [entry], {
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
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
    'Runtime Electron UI passed: Python discovery and PATH updates, Java projects, Flutter diagnostics and command and project entry.'
  )
} finally {
  await server.close()
  await rm(fixture, { force: true })
  assert.equal(dirname(resolve(directory)).toLowerCase(), resolve(tmpdir()).toLowerCase())
  await rm(directory, { recursive: true, force: true })
}
