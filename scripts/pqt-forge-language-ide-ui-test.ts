import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electron from 'electron'
import { createServer } from 'vite'
import viteConfig from '../configs/vite.config'

const directory = await mkdtemp(join(tmpdir(), 'pqt-language-ide-ui-'))
const filename = `.language-ide-${process.pid}.html`
const fixture = resolve('src/render-next', filename)
const server = await createServer({
  ...viteConfig.serverConfig,
  configFile: false,
  cacheDir: join(directory, 'vite'),
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }
})

const document = String.raw`<!doctype html><div id="app"></div><script>
  window.Server = { isWindows: true, BaseDir: 'C:/fixture/', DataDirectoryReady: true }
  window.errors = []
  window.opens = []
  window.addEventListener('error', (event) => errors.push(event.message))
  window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)))
  let receive
  window.QTEnvDevNodeAPI = {
    ipcReceiveFromMain(listener) { receive = listener },
    ipcSendToMain(channel, key, action, ...args) {
      const reply = (code, data, msg) => queueMicrotask(() => receive({}, channel, key, { code, data, msg }))
      if (channel === 'app-fork:version' && action === 'allInstalledVersions') {
        return reply(0, Object.fromEntries(args[0].map((flag) => [flag, []])))
      }
      if (channel === 'app-fork:tools' && action === 'openPathByApp') {
        opens.push(args)
        reply(200)
        window.finishLaunch = (error) => error ? reply(1, undefined, error) : reply(0, true)
        return
      }
      reply(0)
    }
  }
</script><script type="module">
  import { createApp, h } from 'vue'
  import { createPinia } from 'pinia'
  import localForage from 'localforage'
  import { applyLanguagePayload } from '../lang/runtime'
  import LanguageProjectManager from './components/LanguageProjectManager.vue'
  import { nextAppState } from './state/app'
  import './styles/app.css'
  import './styles/websites.css'
  const messages = {}
  for (const [path, load] of Object.entries(import.meta.glob('../lang/en/*.json', { import: 'default' }))) {
    messages[path.split('/').pop().replace('.json', '')] = await load()
  }
  applyLanguagePayload({ locale: 'en', fallbackLocale: 'en', messages, fallbackMessages: messages })
  const records = {
    python: { id: 'python-fixture', path: 'C:/fixture/Python & examples', comment: 'Fixture Python' },
    golang: { id: 'go-fixture', path: 'C:/fixture/Go examples', comment: 'Fixture Go' }
  }
  for (const [flag, record] of Object.entries(records)) {
    await localForage.setItem('qtenvdev-' + flag + '-projects', [record])
  }
  window.fixtureRecords = records
  const app = createApp({
    render: () => [
      h(LanguageProjectManager, { initialLanguage: 'python' }),
      h('output', { id: 'fixture-notice' }, nextAppState.toast)
    ]
  }).use(createPinia())
  app.config.errorHandler = (error) => errors.push(error.stack || String(error))
  app.mount('#app')
</script>`

const checks = String.raw`(async () => {
  async function wait(condition, label) {
    for (let attempt = 0; attempt < 420; attempt++) {
      if (errors.length) throw new Error(errors.join('\n'))
      if (condition()) return
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    throw new Error('Timed out waiting for ' + label + '\n' + document.body.innerText.slice(0, 1000))
  }
  const action = (id) => document.querySelector('[data-project-id="' + id + '"]')?.closest('tr')?.querySelector('button[aria-label=Action]')
  const ide = (name) => [...document.querySelectorAll('.project-ide-action')]
    .find((button) => button.textContent.includes(name) && button.getClientRects().length > 0)
  const language = () => document.querySelector('.project-manager-controls select')
  const select = (value) => {
    language().value = value
    language().dispatchEvent(new Event('change', { bubbles: true }))
  }
  async function openMenu(kind, name) {
    await wait(() => action(fixtureRecords[kind].id), kind + ' project menu')
    action(fixtureRecords[kind].id).click()
    await wait(() => ide(name), name + ' sidebar action')
    return ide(name)
  }

  await wait(() => window.fixtureRecords, 'language project fixture setup')
  const python = await openMenu('python', 'PyCharm')
  python.click()
  await wait(() => opens.length === 1 && python.disabled, 'one in-flight PyCharm launch')
  python.click()
  if (opens.length !== 1 || opens[0][0] !== fixtureRecords.python.path || opens[0][1] !== 'PyCharm') {
    throw new Error('PyCharm did not receive the selected path exactly once')
  }
  window.finishLaunch('Fixture PyCharm was not found.')
  await wait(() => !python.disabled && document.querySelector('#fixture-notice').textContent.includes('Fixture PyCharm'), 'PyCharm terminal failure and retry')

  select('golang')
  const go = await openMenu('golang', 'GoLand')
  if (ide('PyCharm')) throw new Error('Go should display only its own IDE shortcut')
  go.click()
  await wait(() => opens.length === 2 && go.disabled, 'GoLand launch')
  if (opens[1][0] !== fixtureRecords.golang.path || opens[1][1] !== 'GoLand') {
    throw new Error('GoLand did not receive the selected Go path')
  }
  window.finishLaunch()
  await wait(() => !go.disabled, 'GoLand terminal success')
})()`

try {
  await writeFile(fixture, document)
  await server.listen()
  const address = server.httpServer?.address()
  assert(address && typeof address === 'object')
  const url = `http://127.0.0.1:${address.port}/render-next/${filename}`
  const entry = join(directory, 'main.cjs')
  await writeFile(
    entry,
    `
    const { app, BrowserWindow } = require('electron')
    app.setPath('userData', ${JSON.stringify(join(directory, 'profile'))})
    app.whenReady().then(async () => {
      const win = new BrowserWindow({ show: false, width: 1200, height: 850, webPreferences: { backgroundThrottling: false } })
      await win.loadURL(${JSON.stringify(url)})
      await win.webContents.executeJavaScript(${JSON.stringify(checks)})
      app.exit(0)
    }).catch((error) => { console.error(error); app.exit(1) })
    setTimeout(() => app.exit(2), 90_000)
  `
  )
  const environment = { ...process.env }
  delete environment.ELECTRON_RUN_AS_NODE
  const result = await new Promise<{ code: number | null; output: string }>((done, reject) => {
    const child = spawn(String(electron), [entry], {
      env: environment,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let output = ''
    child.stdout.on('data', (data) => {
      output += String(data)
    })
    child.stderr.on('data', (data) => {
      output += String(data)
    })
    child.once('error', reject)
    child.once('close', (code) => done({ code, output }))
  })
  assert.equal(result.code, 0, result.output)
  console.log(
    'Language project IDE UI passed (PyCharm, GoLand, exact saved paths and terminal outcomes).'
  )
} finally {
  await server.close()
  await rm(fixture, { force: true })
  await rm(directory, { recursive: true, force: true })
}
