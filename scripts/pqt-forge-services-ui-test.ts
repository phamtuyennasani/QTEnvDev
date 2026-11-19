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
    window.composerScans = []
    window.openedLinks = []
    window.failVersionStop = false
    const apacheVersions = ['2.4.60', '2.4.62'].map((version, num) => ({
      version, num, path: '/fixture/apache-' + version, bin: '/fixture/apache-' + version + '/httpd',
      enable: true
    }))
    const composerVersions = [{ version: '2.8.6', num: 28, path: '/fixture/composer', bin: '/fixture/composer/composer', enable: true }]
    const redisVersion = { version: '7.4.1', num: 74, path: '/fixture/redis', bin: '/fixture/redis/redis-server', enable: true }
    const mongoVersion = { version: '8.2.1', num: 82, path: '/fixture/mongodb', bin: '/fixture/mongodb/mongod', enable: true }
    const nodeVersion = { version: '24.13.0', num: 24, path: '/fixture/node', bin: '/fixture/node/node', enable: true }
    window.dbGateRuntimeInstalled = false
    window.dbGateRequests = []
    const redisConfigPath = '/fixture/redis/redis-7.conf'
    let redisConfig = ''
    window.redisConfigInitializations = []
    window.redisConfigWrites = []
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
          if (args[1].includes('composer')) window.composerScans.push(args[2].composer?.dirs || [])
          return respond(0, Object.fromEntries(args[1].map(flag => [
            flag, flag === 'apache' ? apacheVersions
              : flag === 'composer' ? composerVersions
              : flag === 'redis' ? [redisVersion]
              : flag === 'mongodb' ? [mongoVersion]
              : flag === 'node' && window.dbGateRuntimeInstalled ? [nodeVersion] : []
          ])))
        }
        if (channel === 'app-fork:mongodb' && action === 'startService') {
          return respond(0, { 'APP-Service-Start-PID': '4351' })
        }
        if (channel === 'app-fork:mongodb' && action === 'stopService') return respond(0)
        if (channel === 'app-fork:mongodb' && action === 'openDbGate') {
          window.dbGateRequests.push(args[1])
          respond(200)
          window.finishDbGate = () => respond(0, { url: 'http://127.0.0.1:4262' })
          return
        }
        if (channel === 'app-fork:redis' && action === 'listConfigFiles') {
          return respond(0, [{ name: 'main', path: redisConfigPath, exists: Boolean(redisConfig) }])
        }
        if (channel === 'app-fork:redis' && action === 'initConf') {
          window.redisConfigInitializations.push(args[1])
          respond(200)
          window.finishRedisConfig = () => {
            redisConfig = '# Redis\\nport 6379\\n# keep this setting\\nappendonly yes\\n'
            respond(0, redisConfigPath)
          }
          return
        }
        if (channel === 'App-Node-FN' && action === 'fs' && args[2] === redisConfigPath) {
          if (!key.startsWith('IPC-Key-Sensitive-')) errors.push('Redis config content was sent through logging IPC')
          if (args[1] === 'writeFile') {
            redisConfig = args[3]
            window.redisConfigWrites.push(redisConfig)
          }
          return queueMicrotask(() => receive({}, channel, key, args[1] === 'writeFile' ? true : redisConfig))
        }
        if (channel === 'app-fork:composer' && action === 'fetchAllOnlineVersion') {
          return respond(0, [{ version: '2.9.1', appDir: '/fixture/composer-2.9.1', bin: '/fixture/composer-2.9.1/composer', url: 'https://getcomposer.org/download/2.9.1/composer.phar' }])
        }
        if (channel === 'App-Node-FN' && action === 'shell' && args[1] === 'openExternal') {
          window.openedLinks.push(args[2])
          return queueMicrotask(() => receive({}, channel, key, undefined))
        }
        if (channel === 'App-Node-FN' && action === 'dialog' && args[1] === 'showOpenDialog') {
          return queueMicrotask(() => receive({}, channel, key, { canceled: false, filePaths: ['/other/composer'] }))
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
        if (channel === 'app-fork:git' && action === 'checkInstalled') {
          return respond(0, { installed: true, version: 'git version 2.54.0' })
        }
        if (channel === 'app-fork:git' && action === 'check') {
          return respond(0, { items: [{ label: 'Git LFS', ok: false, value: 'git-lfs --version', message: 'Not found' }] })
        }
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
    const exact = (label, selector = 'main button') => [...document.querySelectorAll(selector)].find(button => button.textContent.trim() === label)
    const has = label => document.querySelector('main').textContent.includes(label)
    const wait = async (condition, label) => {
      for (let i = 0; i < 240; i++) {
        if (errors.length) throw new Error(errors.join('\\n'))
        if (condition()) return
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      throw new Error('Timed out: ' + label)
    }
    const click = async (label, selector) => {
      await wait(() => exact(label, selector) && !exact(label, selector).disabled, label)
      exact(label, selector).click()
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
    const redisRow = () => [...document.querySelectorAll('.database-item')].find(row => row.querySelector('b')?.textContent === 'Redis')
    await wait(() => redisRow()?.textContent.includes('7.4.1'), 'installed Redis in Databases')
    redisRow().click()
    await click('Configuration')
    await wait(() => typeof window.finishRedisConfig === 'function', 'missing Redis config initialization')
    await click('Close', '[role=dialog] button')
    await click('Configuration')
    window.finishRedisConfig()
    const redisPort = () => document.querySelector('input[aria-label="Port value"]')
    await wait(() => redisPort()?.value === '6379' && !redisPort().disabled, 'Redis common settings after reopening')
    if (window.redisConfigInitializations.length !== 1 || window.redisConfigInitializations[0].bin !== '/fixture/redis/redis-server') {
      throw new Error('Redis initialization did not target the selected version exactly once')
    }
    redisPort().value = '6381'
    redisPort().dispatchEvent(new Event('input', { bubbles: true }))
    await click('Raw file', '[role=dialog] button')
    await wait(() => document.querySelector('[aria-label="Redis configuration file"]')?.value.includes('port 6381'), 'Redis common edit in raw file')
    await click('Save configuration', '[role=dialog] button')
    await wait(() => window.redisConfigWrites.length === 1, 'saved Redis configuration')
    if (window.redisConfigWrites[0] !== '# Redis\\nport 6381\\n# keep this setting\\nappendonly yes\\n') throw new Error('Redis common edit changed an unrelated setting')
    await wait(() => !exact('Save configuration', '[role=dialog] button'), 'Redis configuration dialog closed')
    if (exact('Open Redis Commander')) throw new Error('Stopped Redis exposes its admin panel')
    const mongoRow = () => [...document.querySelectorAll('.database-item')].find(row => row.querySelector('b')?.textContent === 'MongoDB')
    await wait(() => mongoRow()?.textContent.includes('8.2.1'), 'installed MongoDB in Databases')
    mongoRow().click()
    await wait(() => exact('Start') && !exact('Open DbGate'), 'stopped MongoDB admin gate')
    await click('Start')
    await click('Open DbGate')
    await wait(() => document.body.textContent.includes('DbGate requires NodeJS.') && exact('Open DbGate'), 'DbGate preparation reports missing Node')
    if (window.dbGateRequests.length) throw new Error('DbGate started without Node')
    window.dbGateRuntimeInstalled = true
    await click('Open DbGate')
    await wait(() => window.dbGateRequests.length === 1 && exact('Opening…')?.disabled, 'DbGate starts after Node is detected in Databases')
    if (window.dbGateRequests[0].bin !== '/fixture/node/node') throw new Error('DbGate did not use the discovered Node binary')
    window.finishDbGate()
    await wait(() => window.openedLinks.includes('http://127.0.0.1:4262') && exact('Open DbGate'), 'DbGate terminal result')
    await click('Stop')
    await wait(() => !exact('Open DbGate') && exact('Start'), 'DbGate gated after MongoDB stops')
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
    document.querySelector('.forge-close').click()
    await click('Git environment')
    await wait(() => {
      const dialog = document.querySelector('.forge-dialog')
      return dialog?.textContent.includes('git version 2.54.0') &&
        dialog.textContent.includes('Git LFS') && dialog.textContent.includes('Unavailable')
    }, 'Git diagnostics and individual unavailable tools')
    document.querySelector('.forge-close').click()
    runtime('PHP').click()
    await click('Composer')
    await wait(() => document.querySelector('.composer-versions')?.textContent.includes('/fixture/composer'), 'installed Composer')
    await click('Official downloads', '.composer-actions button')
    if (!window.openedLinks.includes('https://getcomposer.org/download/')) throw new Error('Composer did not open its official download page')
    await click('Discovery folders', '.composer-actions button')
    await wait(() => document.querySelector('.custom-path .add'), 'Composer discovery folder controls')
    document.querySelector('.custom-path .add').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wait(() => document.querySelector('.custom-path input')?.value === '/other/composer', 'Composer custom folder')
    document.querySelector('.custom-path .el-dialog__headerbtn').click()
    await wait(() => window.composerScans.some(dirs => dirs.includes('/other/composer')), 'Composer rescanned custom folder')
    await click('Manage Composer packages', '.composer-actions button')
    await wait(() => document.querySelector('.package-toolbar select')?.value === 'composer' &&
      document.querySelector('.package-table')?.textContent.includes('2.9.1'), 'Composer package catalog')
    document.querySelector('.package-close').click()
    await click('+ Add runtime')
    await wait(() => document.querySelector('.package-toolbar select')?.value === 'php', 'ordinary package entry selects PHP again')
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
    'Services Electron UI passed: installed versions, module visibility, Redis configuration, database admin gates, tunnel lifecycle, HTTP Serve, Podman, runtime managers, Git diagnostics and Composer.'
  )
} finally {
  await vite.close()
  await rm(fixture, { force: true })
  await rm(directory, { recursive: true, force: true })
}
