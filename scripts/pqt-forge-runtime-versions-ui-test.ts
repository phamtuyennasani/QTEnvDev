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
window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)))
const python = (version, path) => ({
  typeFlag: 'python', version, path, num: Number(version.split('.').slice(0, 2).join('')),
  bin: path + '/bin/python3', enable: true, run: false, running: false
})
const pythonVersions = [python('3.12.9', '/fixture/python312'), python('3.13.2', '/fixture/python313')]
const folder = '/fixture/python-custom'
window.pathWrites = []
window.scans = []
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
})()`

try {
  await writeFile(
    fixture,
    `<!doctype html><div id="app"></div><script>${setup}</script>
<script type="module">
  import { createApp } from 'vue'
  import { createPinia } from 'pinia'
  import Runtimes from './screens/RuntimesScreen.vue'
  import { applyLanguagePayload } from '../lang/runtime.ts'
  import './styles/app.css'
  const messages = {}
  for (const [path, load] of Object.entries(import.meta.glob('../lang/en/*.json', { import: 'default' }))) {
    messages[path.split('/').pop().replace('.json', '')] = await load()
  }
  applyLanguagePayload({ locale: 'en', fallbackLocale: 'en', messages, fallbackMessages: messages })
  const app = createApp(Runtimes).use(createPinia())
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
    'Runtime versions Electron UI passed: Python discovery, PATH update across reopening, live summary and custom folder rescan.'
  )
} finally {
  await server.close()
  await rm(fixture, { force: true })
  assert.equal(dirname(resolve(directory)).toLowerCase(), resolve(tmpdir()).toLowerCase())
  await rm(directory, { recursive: true, force: true })
}
