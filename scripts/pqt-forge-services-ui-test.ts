import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electron from 'electron'
import { createServer } from 'vite'
import viteConfig from '../configs/vite.config'

const directory = await mkdtemp(join(tmpdir(), 'pqt-services-ui-'))
const filename = `.services-ui-${process.pid}.html`
const fixture = resolve('src/render-next', filename)
const vite = await createServer({
  ...viteConfig.serverConfig,
  configFile: false,
  cacheDir: join(directory, 'vite'),
  server: { port: 0, host: '127.0.0.1', hmr: false, watch: null }
})
try {
  await writeFile(
    fixture,
    `<!doctype html><div id="app"></div><script>
    window.errors = []
    window.addEventListener('error', e => errors.push(e.message))
    window.addEventListener('unhandledrejection', e => errors.push(String(e.reason)))
    let receive, discovery = 0, running = false
    const path = 'C:/fixture/shared'
    window.tunnelStops = 0
    window.Server = { isLinux: true, UserHome: '/tmp/qtenvdev-fixture', DataDirectoryReady: true }
    window.versionStarts = []
    window.versionStops = []
    window.visibilityWrites = []
    window.failVersionStop = false
    const apacheVersions = ['2.4.60', '2.4.62'].map((version, num) => ({
      version, num, path: '/fixture/apache-' + version, bin: '/fixture/apache-' + version + '/httpd',
      enable: true
    }))
    window.QTEnvDevNodeAPI = {
      ipcReceiveFromMain(listener) { receive = listener },
      ipcSendToMain(channel, key, ...args) {
        const respond = (code, data, msg) => queueMicrotask(() => receive({}, channel, key, { code, data, msg }))
        const [action] = args
        if (channel === 'application:save-preference') {
          window.visibilityWrites.push(action.setup.common.showItem)
          return respond(0)
        }
        if (channel === 'app-fork:version' && action === 'allInstalledVersions') {
          return respond(0, Object.fromEntries(args[1].map(flag => [flag, flag === 'apache' ? apacheVersions : []])))
        }
        if (channel === 'app-fork:apache' && action === 'startService') {
          window.versionStarts.push(args[1].version)
          respond(200, 'Starting the fixture')
          window.finishVersionStart = () => respond(0, { 'APP-Service-Start-PID': '1234' })
          return
        }
        if (channel === 'app-fork:apache' && action === 'stopService') {
          window.versionStops.push(args[1].version)
          return window.failVersionStop ? respond(1, undefined, 'Apache stop fixture failed') : respond(0)
        }
        if (channel === 'app-fork:cloudflare-tunnel' && action === 'start') {
          respond(200, 'Starting the fixture tunnel')
          window.finishTunnelStart = () => respond(0, { 'APP-Service-Start-PID': '4567' })
          return
        }
        if (channel === 'app-fork:cloudflare-tunnel' && action === 'stopService') {
          window.tunnelStops++
          return respond(0)
        }
        if (channel === 'app-fork:golang' && action === 'checkGvm') return respond(0, '')
        if (channel === 'app-http-serve-manage') {
          if (action === 'start') running = true
          if (action === 'stop') running = false
          return respond(0, action === 'list' ? {
            folders: [path], active: running ? [{ path, port: 4173, host: ['http://localhost:4173/'] }] : []
          } : {})
        }
        if (channel === 'app-fork:podman') {
          if (action === 'podmanInit') {
            if (++discovery === 1) return respond(1, undefined, 'Discovery fixture failed')
            return respond(0, { version: '5.0.0', machine: [
              { name: 'fixture-machine', run: true, info: { State: 'running' } }
            ] })
          }
          if (action === 'fetchMachineInfo') return respond(0, { info: { State: 'running' } })
          return respond(0)
        }
        return respond(0)
      }
    }
  </script><script type="module">
    import { createApp } from 'vue'
    import { createPinia } from 'pinia'
    import { applyLanguagePayload } from '../lang/runtime.ts'
    import { AppStore } from '../render/store/app.ts'
    import { StorageSetAsync } from '../render/util/Storage.ts'
    import AppNext from './AppNext.vue'
    const messages = {}
    for (const [path, load] of Object.entries(import.meta.glob('../lang/en/*.json', { import: 'default' }))) {
      messages[path.split('/').pop().replace('.json', '')] = await load()
    }
    applyLanguagePayload({ locale: 'en', fallbackLocale: 'en', messages, fallbackMessages: messages })
    const app = createApp(AppNext).use(createPinia())
    AppStore().config.setup.common.showItem.mysql = false
    await StorageSetAsync('qtenvdev-cloudflare-tunnel-store', [{
      id: 'fixture-tunnel', tunnelName: 'fixture-tunnel',
      cloudflaredBin: '/fixture/cloudflared', dns: [{
        zoneName: 'example.test', subdomain: 'fixture', localService: 'localhost:8080'
      }]
    }])
    app.config.errorHandler = error => errors.push(error.stack || String(error))
    app.mount('#app')
  </script>`
  )
  await vite.listen()
  const address = vite.httpServer?.address()
  assert(address && typeof address === 'object')
  const checks = `(async () => {
    const exact = label => [...document.querySelectorAll('main button')].find(button => button.textContent.trim() === label)
    const has = label => document.querySelector('main').textContent.includes(label)
    const wait = async (condition, label) => {
      for (let i = 0; i < 240; i++) {
        if (errors.length) throw new Error(errors.join('\\n'))
        if (condition()) return
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      throw new Error('Timed out: ' + label)
    }
    const click = async label => {
      await wait(() => exact(label) && !exact(label).disabled, label)
      exact(label).click()
    }
    await wait(() => document.querySelector('.nav-item'), 'shell')
    ;[...document.querySelectorAll('.nav-item')].find(button => button.textContent.includes('Services')).click()
    await click('Installed versions')
    const apacheRow = version => [...document.querySelectorAll('.installed-versions-surface tr.el-table__row')]
      .find(row => row.querySelector('td')?.textContent.trim() === version)
    const apacheNext = () => apacheRow('2.4.62')
    await wait(() => apacheRow('2.4.60')?.querySelector('.truncate.current') && apacheNext()?.querySelector('.status.start'), 'installed Apache versions')
    apacheNext().querySelector('.status.start').click()
    await wait(() => window.versionStarts.length === 1 && apacheNext()?.querySelector('.is-loading'), 'Apache version starting')
    document.querySelector('.forge-close').click()
    await click('Installed versions')
    await wait(() => apacheNext()?.querySelector('.is-loading'), 'active operation after reopening')
    window.finishVersionStart()
    await wait(() => apacheNext()?.querySelector('.status.running') && apacheNext()?.querySelector('.truncate.current'), 'second Apache version running')
    if (window.versionStarts.join() !== '2.4.62') throw new Error('Unexpected Apache start requests')
    document.querySelector('.forge-close').click()
    await wait(() => document.querySelector('.service-detail-panel .detail-kind code')?.textContent === '2.4.62', 'running version in Services detail')
    const navigation = label => [...document.querySelectorAll('.nav-item')].find(button => button.textContent.includes(label))
    const modulesButton = () => [...document.querySelectorAll('.settings-nav button')]
      .find(button => button.lastChild.textContent.trim() === 'Modules')
    const openModules = async () => {
      await wait(() => modulesButton(), 'Modules setting')
      modulesButton().click()
    }
    navigation('Settings').click()
    await openModules()
    const apacheToggle = () => document.querySelector('input[data-module=apache]')
    await wait(() => apacheToggle()?.checked && !apacheToggle().disabled, 'saved module visibility')
    window.failVersionStop = true
    apacheToggle().click()
    await wait(() => has('Apache stop fixture failed') && apacheToggle()?.checked && !apacheToggle().disabled, 'module stays visible after failed stop')
    window.failVersionStop = false
    apacheToggle().click()
    await wait(() => apacheToggle() && !apacheToggle().checked && window.visibilityWrites.at(-1)?.apache === false, 'module hidden after confirmed stop')
    navigation('Databases').click()
    await wait(() => document.querySelector('.database-detail-panel h2')?.textContent === 'MariaDB', 'first visible database selected')
    if ([...document.querySelectorAll('.database-item b')].some(b => b.textContent === 'MySQL')) throw new Error('Hidden MySQL is in the database list')
    navigation('Services').click()
    await wait(() => document.querySelector('.service-detail-panel h2')?.textContent !== 'Apache', 'next visible service selected')
    if ([...document.querySelectorAll('.service-item b')].some(b => b.textContent === 'Apache')) throw new Error('Hidden Apache is in the service list')
    navigation('Settings').click()
    await openModules()
    await wait(() => apacheToggle() && !apacheToggle().checked && !apacheToggle().disabled, 'hidden module after reopening Settings')
    apacheToggle().click()
    await wait(() => apacheToggle()?.checked && window.visibilityWrites.at(-1)?.apache === true, 'module shown')
    navigation('Services').click()
    const tunnelService = () => [...document.querySelectorAll('.service-item')]
      .find(row => row.querySelector('b')?.textContent === 'Cloudflare Tunnel')
    await wait(() => tunnelService(), 'Cloudflare Tunnel service')
    tunnelService().click()
    await click('Manage tunnels')
    const tunnel = selector => document.querySelector('.forge-tunnel-list ' + selector)
    await wait(() => tunnel('.status.start svg') && tunnel('.el-table').textContent.includes('fixture.example.test'), 'saved tunnel rule')
    tunnel('.status.start svg').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wait(() => window.finishTunnelStart && tunnel('.is-loading'), 'tunnel starting')
    document.querySelector('.forge-close').click()
    await click('Manage tunnels')
    await wait(() => tunnel('.is-loading'), 'active tunnel operation after reopening')
    window.finishTunnelStart()
    await wait(() => tunnel('.status.running'), 'tunnel running')
    document.querySelector('.forge-close').click()
    await wait(() => tunnelService().querySelector('.state-label').textContent === 'Running', 'running tunnel in Services')
    navigation('Settings').click()
    await openModules()
    const tunnelToggle = () => document.querySelector('input[data-module=cloudflare-tunnel]')
    await wait(() => tunnelToggle()?.checked && !tunnelToggle().disabled, 'tunnel visibility')
    tunnelToggle().click()
    await wait(() => window.tunnelStops === 1 && tunnelToggle()?.checked === false, 'running tunnel stopped before hiding')
    navigation('Services').click()
    await wait(() => exact('HTTP Serve') && !tunnelService(), 'hidden tunnel in Services')
    await click('HTTP Serve')
    await wait(() => exact('Start') && has('C:/fixture/shared'), 'saved HTTP Serve folder')
    await click('Start')
    await wait(() => exact('Copy') && has('http://localhost:4173/'), 'HTTP endpoint')
    await click('Back to services')
    await click('HTTP Serve')
    await wait(() => exact('Stop') && has('http://localhost:4173/'), 'active server after reopening')
    await click('Stop')
    await wait(() => exact('Start') && !exact('Copy'), 'HTTP server stopped')
    await click('Back to services')
    await click('Podman')
    await wait(() => has('Discovery fixture failed'), 'Podman discovery error')
    await click('Refresh')
    await wait(() => has('fixture-machine'), 'Podman machine discovery')
    await wait(() => document.querySelector('main input[value=Compose]'), 'Compose tab')
    document.querySelector('main input[value=Compose]').click()
    await wait(() => document.querySelector('.app-container-detail .el-table'), 'Compose list')
    ;[...document.querySelectorAll('.nav-item')].find(button => button.textContent.includes('Runtimes')).click()
    const runtime = name => [...document.querySelectorAll('.runtime-item')]
      .find(button => button.querySelector('b').textContent === name)
    await wait(() => runtime('Node.js'), 'Node.js runtime')
    runtime('Node.js').click()
    await click('Node.js version managers')
    await wait(() => document.querySelector('.runtime-workflow')?.textContent.includes('fnm') &&
      document.querySelector('.runtime-workflow')?.textContent.includes('nvm'), 'Node.js managers')
    document.querySelector('.forge-close').click()
    runtime('Go').click()
    await click('Go Version Manager')
    await wait(() => document.querySelector('.runtime-workflow')?.textContent.includes('Install GVM?'), 'GVM controls')
  })()`
  const entry = join(directory, 'main.cjs')
  await writeFile(
    entry,
    `
    const { app, BrowserWindow } = require('electron')
    app.setPath('userData', ${JSON.stringify(join(directory, 'profile'))})
    app.whenReady().then(async () => {
      const window = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } })
      await window.loadURL(${JSON.stringify(`http://127.0.0.1:${address.port}/render-next/${filename}`)})
      await window.webContents.executeJavaScript(${JSON.stringify(checks)})
      app.exit(0)
    }).catch(error => { console.error(error); app.exit(1) })
    setTimeout(() => {
      console.error('Services Electron fixture exceeded its deadline.')
      app.exit(2)
    }, 90_000)
  `
  )
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const result = await new Promise<{ code: number | null; output: string }>((done, reject) => {
    const child = spawn(String(electron), [entry], { env, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk
    })
    child.stderr.on('data', (chunk) => {
      output += chunk
    })
    child.once('error', reject)
    child.once('close', (code) => done({ code, output }))
  })
  assert.equal(result.code, 0, result.output)
  console.log(
    'Services Electron UI passed: installed versions, module visibility, tunnel lifecycle, HTTP Serve, Podman and runtime managers.'
  )
} finally {
  await vite.close()
  await rm(fixture, { force: true })
  await rm(directory, { recursive: true, force: true })
}
