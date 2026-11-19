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
    window.addEventListener('error', e => errors.push(e.error?.stack || e.message))
    window.addEventListener('unhandledrejection', e => errors.push(e.reason?.stack || String(e.reason)))
    let receive, discovery = 0, running = false
    const path = 'C:/fixture/shared'
    window.tunnelStops = 0
    window.Server = { isLinux: true, UserHome: '/tmp/qtenvdev-fixture', BaseDir: '/fixture', DataDirectoryReady: true }
    window.versionStarts = []
    window.versionStops = []
    window.visibilityWrites = []
    window.composerScans = []
    window.openedLinks = []
    window.openedDirectories = []
    window.consulStarts = []
    window.consulBrowserLaunches = []
    window.tomcatRequests = []
    window.tomcatDirectoryWrites = 0
    window.n8nRequests = []
    window.failVersionStop = false
    const apacheVersions = ['2.4.60', '2.4.62'].map((version, num) => ({
      version, num, path: '/fixture/apache-' + version, bin: '/fixture/apache-' + version + '/httpd',
      enable: true
    }))
    const composerVersions = [{ version: '2.8.6', num: 28, path: '/fixture/composer', bin: '/fixture/composer/composer', enable: true }]
    const redisVersion = { version: '7.4.1', num: 74, path: '/fixture/redis', bin: '/fixture/redis/redis-server', enable: true }
    const consulVersion = { version: '1.21.3', num: 121, path: '/fixture/consul-app', bin: '/fixture/consul-app/consul', enable: true }
    const tomcatVersions = ['9.0.106', '10.1.46'].map((version, num) => ({
      version, num, path: '/fixture/tomcat-' + version,
      bin: '/fixture/tomcat-' + version + '/bin/startup.sh', enable: true
    }))
    const mongoVersion = { version: '8.2.1', num: 82, path: '/fixture/mongodb', bin: '/fixture/mongodb/mongod', enable: true }
    const neo4jVersion = { version: '5.26.0', num: 526, path: '/fixture/neo4j-app', bin: '/fixture/neo4j-app/bin/neo4j', enable: true }
    const clickhouseVersion = { version: '26.1.0', num: 261, path: '/fixture/clickhouse-app', bin: '/fixture/clickhouse-app/clickhouse', enable: true }
    const javaVersions = ['17.0.2', '21.0.3', '25.0.1'].map(version => ({
      version, num: Number(version.slice(0, 2)), path: '/fixture/java-' + version,
      bin: '/fixture/java-' + version + '/bin/java', enable: true
    }))
    const databaseConfig = {
      neo4j: [{ name: 'neo4j.conf', path: '/fixture/neo4j/instance/neo4j.conf', content: 'server.directories.data=data' }],
      clickhouse: [
        { name: 'config', path: '/fixture/clickhouse/config.xml', content: '<clickhouse />' },
        { name: 'users', path: '/fixture/clickhouse/users.xml', content: '<clickhouse><users /></clickhouse>' }
      ]
    }
    const initialized = new Set()
    window.databaseInitializers = []
    window.neo4jStarts = []
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
              : flag === 'consul' ? [consulVersion]
              : flag === 'tomcat' ? tomcatVersions
              : flag === 'mongodb' ? [mongoVersion]
              : flag === 'neo4j' ? [neo4jVersion]
              : flag === 'clickhouse' ? [clickhouseVersion]
              : flag === 'java' ? javaVersions
              : flag === 'node' && window.dbGateRuntimeInstalled ? [nodeVersion] : []
          ])))
        }
        if (channel === 'app-fork:neo4j' && action === 'startService') {
          window.neo4jStarts.push(args.slice(1))
          return respond(0, { 'APP-Service-Start-PID': '4352' })
        }
        const configFlag = channel.split(':')[1]
        const configs = databaseConfig[configFlag]
        if (configs && action === 'listConfigFiles') {
          return respond(0, configs.map(({name, path}) => ({ name, path,
            exists: initialized.has(configFlag), defaultPath: initialized.has(configFlag) && configFlag === 'clickhouse' ? path + '.default' : undefined
          })))
        }
        if (configs && action === 'initConfig') {
          window.databaseInitializers.push([configFlag, args[1]?.bin])
          respond(200)
          window.finishDatabaseConfig = () => {
            initialized.add(configFlag)
            respond(0, configs[0].path)
          }
          return
        }
        if (channel === 'App-Node-FN' && action === 'fs') {
          const owner = Object.entries(databaseConfig).find(([, files]) => files.some(file => file.path === args[2]))
          if (owner && args[1] === 'readFile') {
            const file = owner[1].find(file => file.path === args[2])
            const response = initialized.has(owner[0]) ? file.content : { code: 1, errorCode: 'ENOENT', msg: 'File does not exist' }
            return queueMicrotask(() => receive({}, channel, key, response))
          }
        }
        if (channel === 'app-fork:mongodb' && action === 'startService') {
          return respond(0, { 'APP-Service-Start-PID': '4351' })
        }
        if (channel === 'app-fork:mongodb' && action === 'stopService') return respond(0)
        if (channel === 'app-fork:consul' && action === 'startService') {
          window.consulStarts.push(args.slice(1))
          return respond(0, { 'APP-Service-Start-PID': '4851' })
        }
        if (channel === 'app-fork:consul' && action === 'stopService') return respond(0)
        if (channel === 'app-fork:n8n') {
          window.n8nRequests.push(action)
          if (action === 'getDataDir') return respond(0, { path: '/fixture/n8n-data' })
          if (action === 'userList') {
            if (!key.startsWith('IPC-Key-Sensitive-')) errors.push('n8n user request used logging IPC')
            return respond(0, [{
              id: 'fixture-user', email: 'account@example.test', firstName: 'Fixture',
              lastName: 'Account', roleSlug: 'global:member', disabled: false, isPending: false
            }])
          }
          if (action === 'fetchAllOnlineVersion') return respond(0, [{
            version: '2.0.1', mVersion: '2', url: 'https://www.npmjs.com/package/n8n'
          }])
        }
        if (channel === 'app-fork:tomcat') {
          window.tomcatRequests.push(args)
          if (action === 'startService') return respond(0, { 'APP-Service-Start-PID': '4852' })
          if (action === 'listConfigFiles') return respond(0, [{
            name: 'server.xml', path: args[2] + '/conf/server.xml', exists: true,
            defaultPath: args[2] + '/conf/server.xml.default'
          }])
          if (action === 'listLogFiles') return respond(0, [])
        }
        if (channel === 'App-Node-FN' && action === 'fs' && args[2]?.startsWith('/new/tomcat/conf/')) {
          const contents = args[2].endsWith('.default') ? '<Server port="8005" />' : '<Server port="8006" />'
          const result = args[1] === 'stat' ? { size: contents.length, isFile: true } : contents
          return queueMicrotask(() => receive({}, channel, key, result))
        }
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
        if (channel === 'App-Node-FN' && action === 'fs' && args[1] === 'readFile' && args[2] === '/fixture/consul/consul-1.json') {
          return queueMicrotask(() => receive({}, channel, key, '{"ports":{"http":48500}}'))
        }
        if (channel === 'App-Node-FN' && action === 'shell' && args[1] === 'openExternalChecked') {
          window.consulBrowserLaunches.push(args[2])
          window.finishConsulBrowser = () => respond(0)
          return
        }
        if (channel === 'App-Node-FN' && action === 'shell' && args[1] === 'openPath') {
          window.openedDirectories.push(args[2])
          return queueMicrotask(() => receive({}, channel, key, ''))
        }
        if (channel === 'App-Node-FN' && action === 'dialog' && args[1] === 'showOpenDialog') {
          if (args[2]?.title === 'Choose service directory') {
            if (args[2].defaultPath.includes('tomcat')) {
              window.finishTomcatPicker = (path) => queueMicrotask(() => receive({}, channel, key, { canceled: !path, filePaths: path ? [path] : [] }))
              return
            }
            if (args[2].defaultPath !== '/legacy/consul') errors.push('Directory picker did not use the legacy path')
            return queueMicrotask(() => receive({}, channel, key, { canceled: false, filePaths: ['/new/consul'] }))
          }
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
    import localForage from 'localforage'
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
    await localForage.setItem('qtenvdev-consul-storage-dir', {
      '/fixture/consul-app/consul': '/legacy/consul',
      '/fixture/another/consul': '/legacy/other-version'
    })
    const tomcatVersion = (version) => ({
      version, path: '/fixture/tomcat-' + version, bin: '/fixture/tomcat-' + version + '/bin/startup.sh'
    })
    const tomcatKey = 'qtenvdev-tomcat-server-root'
    await localForage.setItem(tomcatKey, {
      [tomcatVersion('9.0.106').bin]: '/legacy/tomcat-a',
      [tomcatVersion('10.1.46').bin]: '/legacy/tomcat-b'
    })
    window.selectTomcat = version => AppStore().UPDATE_SERVER_CURRENT({ flag: 'tomcat', data: tomcatVersion(version) })
    const setItem = localForage.setItem.bind(localForage)
    localForage.setItem = (key, data, ...args) => {
      if (key === tomcatKey) {
        window.tomcatDirectoryWrites++
        if (window.failTomcatWrite) return Promise.reject(new Error('Tomcat directory write failed'))
      }
      return setItem(key, data, ...args)
    }
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
    const serviceRow = label => [...document.querySelectorAll('.service-item')]
      .find(row => row.querySelector('b')?.textContent === label)
    for (const service of ['RustFS', 'ETCD', 'Temporal', 'Temporal CLI', 'ZincSearch', 'RNacos', 'Numa', 'CLIProxyAPI']) {
      await wait(() => serviceRow(service), service + ' appears in Services')
    }
    await wait(() => serviceRow('Consul')?.querySelector('.state-label')?.textContent === 'Stopped', 'installed Consul')
    serviceRow('Consul').click()
    await wait(() => has('/legacy/consul') && exact('Change directory'), 'saved Consul directory')
    if (exact('Open Consul UI')) throw new Error('A stopped service exposed its dashboard')
    await click('Open folder')
    await wait(() => window.openedDirectories.includes('/legacy/consul'), 'open the legacy service directory')
    await click('Change directory')
    await wait(() => has('/new/consul'), 'saved Consul directory change')
    await click('Start')
    await wait(() => exact('Open Consul UI') && window.consulStarts.length === 1, 'Consul starts from Services')
    if (window.consulStarts[0][0].bin !== '/fixture/consul-app/consul' || window.consulStarts[0][1] !== '/new/consul') throw new Error('Start did not use the stored Consul directory')
    if (!exact('Change directory').disabled) throw new Error('A running service can change its startup directory')
    await click('Open Consul UI')
    await wait(() => exact('Open Consul UI')?.disabled && window.finishConsulBrowser, 'Consul dashboard launch in flight')
    if (window.consulBrowserLaunches.join() !== 'http://127.0.0.1:48500/ui/') throw new Error('Console ignored the configured port')
    window.finishConsulBrowser()
    await wait(() => !exact('Open Consul UI')?.disabled, 'Consul dashboard terminal result')
    await click('Stop')
    await wait(() => !exact('Open Consul UI') && !exact('Change directory')?.disabled, 'Consul stopped')
    serviceRow('Tomcat').click()
    await wait(() => has('CATALINA_BASE') && has('/legacy/tomcat-a'), 'existing Tomcat base per binary')
    const chooseTomcat = async (path, beforeFinish) => {
      window.finishTomcatPicker = undefined
      await click('Change directory')
      await wait(() => window.finishTomcatPicker && exact('Change directory')?.disabled, 'Tomcat picker in progress')
      beforeFinish?.()
      window.finishTomcatPicker(path)
      await wait(() => !exact('Change directory')?.disabled, 'Tomcat picker terminal result')
    }
    await chooseTomcat('/new/tomcat-stale', () => window.selectTomcat('10.1.46'))
    if (!has('/legacy/tomcat-b') || window.tomcatDirectoryWrites) throw new Error('Stale Tomcat picker changed a directory')
    window.selectTomcat('9.0.106')
    window.failTomcatWrite = true
    await chooseTomcat('/new/tomcat-failed')
    await wait(() => document.body.textContent.includes('Tomcat directory write failed') &&
      has('/legacy/tomcat-a'), 'Tomcat write failure retains original directory')
    window.failTomcatWrite = false
    await chooseTomcat('/new/tomcat')
    await wait(() => has('/new/tomcat'), 'Tomcat directory retry')
    for (const [label, action] of [['Configuration', 'listConfigFiles'], ['Logs', 'listLogFiles']]) {
      await click(label)
      await wait(() => window.tomcatRequests.some(([cmd, version, base]) =>
        cmd === action && version.version === '9.0.106' && base === '/new/tomcat'
      ), 'Tomcat ' + label + ' uses saved base')
      if (action === 'listConfigFiles') {
        const draft = () => document.querySelector('[role=dialog] textarea')
        await wait(() => draft()?.value.includes('8006'), 'saved Tomcat configuration loaded')
        await click('Load default', '[role=dialog] button')
        await wait(() => draft()?.value.includes('8005') &&
          !exact('Save configuration', '[role=dialog] button')?.disabled,
          'Tomcat default replaces the draft and can be saved')
        if (!exact('Import file', '[role=dialog] button') ||
            !exact('Save a copy', '[role=dialog] button') ||
            !exact('Open in editor', '[role=dialog] button')) {
          throw new Error('Tomcat configuration actions are missing')
        }
      }
      await click('Close', '[role=dialog] button')
    }
    await click('Start')
    await wait(() => window.tomcatRequests.some(([cmd, version, base]) =>
      cmd === 'startService' && version.version === '9.0.106' && base === '/new/tomcat'
    ), 'Tomcat Start uses saved base')
    await wait(() => exact('Stop') && !exact('Stop').disabled, 'Tomcat running')
    await click('Stop')
    serviceRow('N8N').click()
    await click('Manage n8n users')
    const n8nDialog = () => document.querySelector('.forge-dialog')
    await wait(() => n8nDialog()?.querySelector('input')?.value === '/fixture/n8n-data' &&
      n8nDialog()?.textContent.includes('account@example.test'), 'n8n stored directory and users')
    document.querySelector('.forge-close').click()
    await click('Manage n8n packages')
    await wait(() => n8nDialog()?.textContent.includes('2.0.1'), 'n8n npm package catalog')
    document.querySelector('.forge-close').click()
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
    const databaseRow = name => [...document.querySelectorAll('.database-item')].find(row => row.querySelector('b')?.textContent === name)
    for (const [name, flag, path, contents] of [
      ['Neo4j', 'neo4j', '/fixture/neo4j-app/bin/neo4j', 'server.directories.data=data'],
      ['ClickHouse', 'clickhouse', '/fixture/clickhouse-app/clickhouse', '<clickhouse><users /></clickhouse>']
    ]) {
      await wait(() => databaseRow(name)?.querySelector('code').textContent !== '—' && databaseRow(name), name + ' installed version')
      databaseRow(name).click()
      await click('Configuration')
      if (flag === 'clickhouse') {
        await wait(() => document.querySelectorAll('.service-file-item').length === 2, 'ClickHouse configuration files')
        document.querySelectorAll('.service-file-item')[1].click()
      }
      await click('Initialize configuration', '[role=dialog] button')
      await wait(() => exact('Initializing…', '[role=dialog] button')?.disabled && window.databaseInitializers.some(request => request[0] === flag), name + ' initialization in progress')
      window.finishDatabaseConfig()
      await wait(() => document.querySelector('.service-file-editor textarea')?.value === contents && document.querySelector('.service-file-editor [role=status]')?.textContent.includes('created'), name + ' initialized configuration')
      const requests = window.databaseInitializers.filter(request => request[0] === flag)
      if (requests.length !== 1 || requests[0][1] !== path) throw new Error('Wrong initialization target: ' + name)
      if (flag === 'clickhouse' && (!exact('Load default', '[role=dialog] button') || [...document.querySelectorAll('.service-file-item small')].some(item => item.textContent === 'Not found'))) {
        throw new Error('ClickHouse file metadata was not refreshed')
      }
      await click('Close', '[role=dialog] button')
    }
    databaseRow('Neo4j').click()
    await click('Installed versions')
    const javaInput = () => document.querySelector('input[aria-label="Java runtime"]')
    const javaOption = () => [...document.querySelectorAll('.el-select-dropdown__item')].find(item => item.textContent.includes('Java 17'))
    await wait(() => javaInput(), 'Neo4j Java picker')
    javaInput().click()
    await wait(() => javaOption(), 'compatible Java versions')
    if ([...document.querySelectorAll('.el-select-dropdown__item')].some(item => item.textContent.includes('Java 25'))) throw new Error('Neo4j offered incompatible Java 25')
    javaOption().click()
    await wait(() => document.querySelector('.installed-versions-surface .el-select__selected-item')?.textContent.includes('Java 17'), 'saved Neo4j Java binding')
    document.querySelector('.forge-close').click()
    await click('Start')
    await wait(() => window.neo4jStarts.length === 1, 'Neo4j start with saved Java')
    if (window.neo4jStarts[0][1].javaHome !== '/fixture/java-17.0.2') throw new Error('Neo4j did not start with the selected Java')
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
