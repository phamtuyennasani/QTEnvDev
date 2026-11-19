import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import electron from 'electron'
import { createServer } from 'vite'
import viteConfig from '../configs/vite.config'

const directory = await mkdtemp(join(tmpdir(), 'pqt-php-extensions-'))
const fixtureName = '.php-extensions-ui-' + process.pid + '.html'
const fixture = resolve('src/render-next', fixtureName)
const server = await createServer({
  ...viteConfig.serverConfig,
  configFile: false,
  server: { port: 0, host: '127.0.0.1', hmr: false }
})
const bootstrap = String.raw`
const source = location.search.slice(1)
const windows = source === 'windows'
const macports = source === 'macports'
const brew = source === 'homebrew' || source === 'linux'
const cellar = '/opt/homebrew/Cellar'
const path = windows ? 'C:/fixture/php' : macports ? '/opt/local' : brew ? cellar + '/php/8.4.3' : cellar + '-backup/php/8.4.3'
const bin = path + (windows ? '/php.exe' : '/sbin/php-fpm')
const version = { typeFlag: 'php', version: '8.4.3', num: 84, bin, path, enable: true, run: false, running: false, flag: macports ? 'macports' : undefined }
const profile = { bin, ini: path + '/php.ini', version: '8.4.3', architecture: 'x64', threadSafety: 'NTS', build: 'VS17', extensionDir: path + '/ext', loaded: ['json'], configured: [] }
window.iniFixture = [
  '[PHP]',
  '; Keep PHP comments as written',
  'memory_limit = 32M  ; earlier global value',
  'memory_limit = 128M  ; effective global value',
  'memory_limit_extra = 11M',
  'error_log = "C:\\logs\\php;errors.log" ; log destination',
  '[PATH=/site]',
  'memory_limit = 64M',
  '[Date]',
  'date.timezone = UTC',
  ''
].join('\r\n')
window.Server = {
  isWindows: windows, isMacOS: !windows && source !== 'linux', isLinux: source === 'linux',
  BrewCellar: cellar, DataDirectoryReady: true, BaseDir: '/fixture/', AppDir: '/fixture/', PhpDir: '/fixture/php/'
}
window.calls = []
window.fixtureErrors = []
window.addEventListener('unhandledrejection', (event) => fixtureErrors.push(String(event.reason)))
let receive
window.QTEnvDevNodeAPI = {
  ipcReceiveFromMain(fn) { receive = fn },
  ipcSendToMain(channel, key, ...args) {
    const [method, target] = args
    calls.push([channel, ...args])
    const send = (response) => queueMicrotask(() => receive({}, channel, key, response))
    const reply = (data) => send({ code: 0, data })
    if (method === 'allInstalledVersions') reply(Object.fromEntries(target.map((flag) => [flag, flag === 'php' ? [version] : []])))
    else if (method === 'getIniPath') reply(profile.ini)
    else if (method === 'initCACertPEM') reply(true)
    else if (method === 'fetchLoadedExtensions') reply([{ name: 'fixture-loaded' }])
    else if (method === 'fetchExtensionDir') reply(profile.extensionDir)
    else if (method === 'fetchLocalExtend') reply({ used: [], local: [] })
    else if (method === 'fetchAllPhpExtensions' || method === 'fetchAllPhpExtensionsByPort') {
      reply([{ name: 'fixture-extension', soname: 'fixture-extension.so', libName: 'fixture-extension', status: false }])
    } else if (String(method).startsWith('windowsExtension')) {
      if (method.toLowerCase().includes('catalog')) reply({ profile, partial: false, packages: [{ name: 'pecl:fixture', source: 'pecl', description: 'Fixture extension' }] })
      else if (method.toLowerCase().includes('prepare')) reply({
        name: 'pecl:fixture', source: 'pecl', homepage: 'https://example.test/fixture', profile,
        releases: [{ version: '1.0.0', compatible: true, url: 'https://example.test/fixture.zip' }]
      })
      else if (method.toLowerCase().includes('install')) {
        send({ code: 200, msg: 'Installing fixture extension' })
        reply({ profile, package: 'pecl:fixture', verified: true, warning: '', backup: '' })
      }
    } else if (channel === 'App-Node-FN') {
      if (method === 'exec') send({ stdout: path + '/ext' })
      else if (target === 'readFile' && args[2] === profile.ini) send(iniFixture)
      else if (target === 'writeFile' && args[2] === profile.ini) { window.iniFixture = args[3]; send(true) }
      else if (target === 'showOpenDialog') window.finishPicker = (file) => send({ canceled: !file, filePaths: file ? [file] : [] })
      else if (target === 'existsSync') send(false)
      else if (target === 'readdir') send([])
      else send(true)
    } else reply([])
  }
}
`

const checks = String.raw`(async () => {
  const source = location.search.slice(1)
  let stage = 'opening'
  const wait = async (check) => {
    for (let attempt = 0; attempt < 240; ++attempt) {
      if (fixtureErrors.length) throw new Error(fixtureErrors.join('\n'))
      const result = check()
      if (result) return result
      await new Promise((done) => setTimeout(done, 25))
    }
    throw new Error(source + ' / ' + stage + ': ' + document.body.innerText.slice(-1600) + '\n' + JSON.stringify(calls.slice(-4)))
  }
  const control = (elements, label) => [...elements].find((node) => node.textContent.trim() === label && !node.disabled)
  const button = (label, root = document) => control(root.querySelectorAll('button'), label)
  const drawer = () => document.querySelector('.pqt-php-extension-surface .php-extensions')
  const tab = (name) => drawer() && control(drawer().querySelectorAll('.el-radio-button'), name)?.querySelector('input')
  const choose = async (name) => {
    const input = await wait(() => tab(name))
    input.checked = true
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const called = (method) => calls.find(([, action]) => action === method)
  if (source === 'windows') {
    stage = 'common PHP configuration'
    await wait(() => button('Edit php.ini')).then((edit) => edit.click())
    const setting = (name) => document.querySelector('[aria-label="' + name + ' value"]')
    const check = (name) => [...document.querySelectorAll('.php-config-field label')]
      .find((label) => label.textContent.trim() === name).querySelector('input')
    const input = (node, value) => {
      node.value = value
      node.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const memory = await wait(() => setting('memory_limit')?.value === '128M' && setting('memory_limit'))
    if (!called('getIniPath')?.[2]?.bin?.endsWith('/php.exe')) throw new Error('PHP configuration did not target the selected binary')
    if (setting('error_log').value !== 'C:\\logs\\php;errors.log') throw new Error('Quoted path was parsed incorrectly')
    if (check('date.timezone').checked || setting('date.timezone').value !== 'PRC') throw new Error('Scoped timezone was mistaken for a global assignment')
    check('date.timezone').click()
    await wait(() => !setting('date.timezone').disabled)
    check('memory_limit').click()
    await wait(() => memory.disabled)
    check('memory_limit').click()
    await wait(() => !memory.disabled)
    input(memory, '256M')
    await wait(() => called('initCACertPEM'))
    stage = 'picking PHP log path'
    const browse = () => document.querySelector('[aria-label="Browse for error_log"]')
    browse().click()
    await wait(() => window.finishPicker && browse().disabled)
    window.finishPicker('C:\\other logs\\new;log.txt')
    await wait(() => !browse().disabled)
    if (setting('error_log').value !== 'C:\\other logs\\new;log.txt') throw new Error('Selected path was not applied: ' + JSON.stringify(setting('error_log').value))
    stage = 'editing the raw PHP configuration'
    button('Raw file').click()
    const raw = await wait(() => document.querySelector('[aria-label="PHP configuration file"]'))
    if (!raw.value.includes(';memory_limit = 32M  ; earlier global value\nmemory_limit = 256M  ; effective global value')) throw new Error('Duplicate global settings were handled incorrectly')
    if (!raw.value.includes('date.timezone = PRC\n[PATH=/site]\nmemory_limit = 64M\n[Date]\ndate.timezone = UTC')) throw new Error('New global setting did not precede scoped sections')
    input(raw, raw.value.replace('memory_limit = 256M', 'memory_limit = 512M'))
    button('Common settings').click()
    await wait(() => setting('memory_limit')?.value === '512M')
    button('Save configuration').click()
    await wait(() => !setting('memory_limit'))
    if (iniFixture.includes('\n') && /(^|[^\r])\n/.test(iniFixture)) throw new Error('Windows line endings were lost')
    if (!iniFixture.includes('; Keep PHP comments as written\r\n') ||
        !iniFixture.includes('memory_limit_extra = 11M\r\n') ||
        !iniFixture.includes('error_log = "C:\\\\other logs\\\\new;log.txt" ; log destination\r\n')) {
      throw new Error('PHP configuration save damaged unrelated text or the selected path')
    }
    stage = 'discarding a pending PHP file picker'
    await wait(() => button('Edit php.ini')).then((edit) => edit.click())
    await wait(() => setting('memory_limit')?.value === '512M')
    window.finishPicker = undefined
    browse().click()
    await wait(() => window.finishPicker && browse().disabled)
    button('Close').click()
    await wait(() => !setting('memory_limit'))
    await wait(() => button('Edit php.ini')).then((edit) => edit.click())
    await wait(() => browse()?.disabled)
    window.finishPicker('C:\\discarded.log')
    await wait(() => !browse().disabled)
    if (setting('error_log').value !== 'C:\\other logs\\new;log.txt') throw new Error('A closed draft received a stale file picker reply')
    button('Close').click()
  }
  stage = 'opening extensions'
  const launch = await wait(() => button('Manage extensions'))
  launch.click()
  await wait(() => drawer()?.textContent.includes('fixture-loaded'))
  if (called('windowsExtensionCatalog')) throw new Error('Opening loaded extensions queried the installer')
  if (source === 'homebrew' || source === 'linux' || source === 'macports') {
    const provider = source === 'macports' ? 'Macports' : 'Homebrew'
    const method = source === 'macports' ? 'fetchAllPhpExtensionsByPort' : 'fetchAllPhpExtensions'
    const other = source === 'macports' ? 'Homebrew' : 'Macports'
    if (tab(other) || tab('Install extensions')) throw new Error('Wrong provider tab')
    await choose(provider)
    await wait(() => drawer().textContent.includes('fixture-extension'))
    if (called(method)?.[2] !== '8.4') throw new Error('Wrong PHP catalog scope')
  } else if (source === 'windows') {
    await choose('Local')
    await wait(() => called('fetchLocalExtend'))
    await choose('Install extensions')
    await wait(() => drawer().textContent.includes('Fixture extension'))
    const prepareInstall = await wait(() => button('Install', drawer()))
    prepareInstall.click()
    const preview = await wait(() => document.querySelector('.php-extension-version-dialog'))
    await wait(() => preview.textContent.includes('Choose extension version'))
    if (called('windowsExtensionInstall')) throw new Error('Install started without release confirmation')
    const confirmInstall = await wait(() => button('Install', preview))
    confirmInstall.click()
    await wait(() => called('windowsExtensionInstall'))
    if (called('windowsExtensionInstall')[4] !== '1.0.0') throw new Error('Selected release was not preserved')
    return
  } else if (tab('Homebrew') || tab('Macports') || tab('Install extensions')) {
    throw new Error('Similar Cellar path was treated as a Homebrew binary')
  }
  stage = 'closing'
  drawer().querySelector('.app-drawer-close').click()
  await wait(() => !document.querySelector('.pqt-php-extension-surface'))
  stage = 'reopening'
  ;(await wait(() => button('Manage extensions'))).click()
  await wait(() => drawer()?.textContent.includes('fixture-loaded'))
})()`

try {
  await writeFile(fixture, `<!doctype html><div id="app"></div><script>${bootstrap}</script>
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
  app.config.errorHandler = (error) => fixtureErrors.push(error?.stack || String(error))
  app.mount('#app')
</script>`)
  await server.listen()
  const address = server.httpServer?.address()
  assert(address && typeof address !== 'string')
  const url = `http://127.0.0.1:${address.port}/render-next/${fixtureName}`
  const entry = join(directory, 'main.cjs')
  await writeFile(entry, `const { app, BrowserWindow } = require('electron')
app.setPath('userData', ${JSON.stringify(join(directory, 'profile'))})
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1200, height: 800, webPreferences: { backgroundThrottling: false } })
  for (const query of ['homebrew', 'linux', 'macports', 'static', 'windows']) {
    await win.loadURL(${JSON.stringify(url)} + '?' + query)
    await win.webContents.executeJavaScript(${JSON.stringify(checks)})
  }
  app.exit(0)
}).catch((error) => { console.error(error); app.exit(1) })
setTimeout(() => app.exit(2), 60000)`)
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const result = await new Promise<{ code: number | null; output: string }>((done, reject) => {
    const child = spawn(String(electron), [entry], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (data) => { output += data })
    child.stderr.on('data', (data) => { output += data })
    child.once('error', reject)
    child.once('close', (code) => done({ code, output }))
  })
  assert.equal(result.code, 0, result.output)
  console.log('PHP Electron UI passed: common and raw configuration, path selection and draft lifetime, loaded and Homebrew/MacPorts extensions, Windows release confirmation.')
} finally {
  await server.close()
  await rm(fixture, { force: true })
  assert.equal(dirname(resolve(directory)).toLowerCase(), resolve(tmpdir()).toLowerCase())
  await rm(directory, { recursive: true, force: true })
}
