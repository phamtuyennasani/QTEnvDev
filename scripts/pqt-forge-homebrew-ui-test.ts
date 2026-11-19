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
  cacheDir: join(directory, 'vite'),
  server: { port: 0, host: '127.0.0.1', hmr: false }
})
const bootstrap = String.raw`
const bootstrapCase = location.search === '?bootstrap'
const portsCase = location.search === '?ports'
const databaseCase = location.search === '?database'
const directCase = location.search === '?direct'
const mac = location.search === '?mac' || bootstrapCase || portsCase
window.Server = {
  isMacOS: mac, isWindows: !mac, BaseDir: '/fixture/', AppDir: '/fixture/', DataDirectoryReady: databaseCase || directCase,
  Static: "/Applications/Env's Dev.app/Contents/Resources/app.asar/dist/electron/static",
  MysqlDir: databaseCase ? 'C:/fixture/mysql/data' : undefined,
  MariaDBDir: databaseCase ? 'C:/fixture/mariadb/data' : undefined,
  BrewBin: mac && !bootstrapCase ? '/opt/homebrew/bin/brew' : '',
  BrewCellar: mac && !bootstrapCase ? '/opt/homebrew/Cellar' : '',
  MacPorts: portsCase ? "/opt/Port's path/bin/port" : ''
}
const formula = 'homebrew/core/php'
let installed = false, current = '8.4', tapEnabled = false, receive
let portInstalled = false
let phpMyAdminCreated = false
const phpMyAdminHost = { name: 'phpmyadmin.test', type: 'php', isAppPHPMyAdmin: true, useSSL: true, port: { nginx_ssl: 4443 } }
const createdDatabases = {}
window.flutterFixtureUrls = {
  stable: 'https://example.test/stable/flutter.zip',
  beta: 'https://example.test/beta/flutter.zip?target=windows&arch=x64'
}
const fixtureVersion = (flag) => ({
  bin: 'C:/fixture/' + flag + '/bin/mysqld.exe', path: 'C:/fixture/' + flag, version: flag === 'mysql' ? '8.4.1' : '11.4.2',
  typeFlag: flag, num: flag === 'mysql' ? 80401 : 110402, enable: true, run: true, running: false
})
window.calls = []
window.projectErrors = []
window.addEventListener('error', (event) => projectErrors.push(event.error?.stack || event.message))
window.addEventListener('unhandledrejection', (event) => projectErrors.push(String(event.reason)))
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
      if (action !== 'fixture-pty' || args[2] !== 'direct' || args[3] !== true) {
        throw new Error('Terminal must report real command exit')
      }
      if (!portsCase && (
          first.length !== 1 || !first[0].includes("Env's Dev".replace("'", "'\\''")) ||
          !first[0].endsWith("/app.asar.unpacked/dist/electron/static/sh/brew-install-en.sh'"))) {
        throw new Error('Incorrect installer command ' + JSON.stringify(args))
      }
      if (portsCase && (!first[0].includes("Port'\\''s path/bin/port") || !first[0].includes("'php85-fpm'"))) {
        throw new Error('Incorrect MacPorts command ' + JSON.stringify(args))
      }
      queueMicrotask(() => receive({}, 'NodePty:data:fixture-pty', 'NodePty:data:fixture-pty', 'Fixture installer prompt'))
      window.finishPtyExec = (exitCode) => {
        window.finishPtyExec = undefined
        if (exitCode === 0) {
          if (portsCase) portInstalled = first[0].includes(' install -v ')
          success({ exitCode })
        }
        else send({ code: 1, data: { exitCode }, msg: 'Terminal exited with code ' + exitCode })
      }
    } else if (channel === 'NodePty:stop') {
      if (action !== 'fixture-pty') throw new Error('Stopped the wrong PTY')
      window.finishPtyExec = undefined
      success()
    } else if (channel === 'App-Node-FN' && action === 'nativeTheme') {
      send(true)
    } else if (channel === 'App-Node-FN' && action === 'clipboard' && first === 'writeText') {
      send(!window.failFixtureCopy)
    } else if (directCase && channel === 'app-fork:flutter' && action === 'fetchAllOnlineVersion') {
      success([
        { version: '3.38.2', channel: 'stable', url: flutterFixtureUrls.stable, bin: '/fixture/flutter/stable/flutter.bat', appDir: '/fixture/flutter/stable' },
        { version: '3.39.0-0.1.pre', channel: 'beta', url: flutterFixtureUrls.beta, bin: '/fixture/flutter/beta/flutter.bat', appDir: '/fixture/flutter/beta' }
      ])
    } else if (channel === 'app-refresh-macos-homebrew') {
      window.finishDiscovery = (ok) => {
        window.finishDiscovery = undefined
        if (ok) success({ bin: '/opt/homebrew/bin/brew', cellar: '/opt/homebrew/Cellar' })
        else send({ code: 1, msg: 'Homebrew detection unavailable' })
      }
    } else if ((databaseCase || directCase) && channel === 'app-fork:version' && action === 'allInstalledVersions') {
      success(Object.fromEntries(first.map((flag) => [flag, databaseCase && ['mysql', 'mariadb', 'nginx', 'php'].includes(flag) ? [fixtureVersion(flag)] : []])))
    } else if (databaseCase && action === 'databaseConnectionEndpoint') {
      const flag = channel.slice('app-fork:'.length)
      if (first?.bin !== fixtureVersion(flag).bin || first?.rootPassword) throw new Error('Incorrect phpMyAdmin database version snapshot')
      success({ port: flag === 'mysql' ? 4406 : 4407 })
    } else if (databaseCase && channel === 'app-fork:host' && action === 'hostList') {
      success({ host: phpMyAdminCreated ? [phpMyAdminHost] : [] })
    } else if (databaseCase && channel === 'app-fork:host' && action === 'addPhpMyAdminSite') {
      send({ code: 200, msg: 32 })
      window.finishPhpMyAdmin = () => {
        phpMyAdminCreated = true
        success({ warnings: ['Fixture hosts sync failed after site creation.'] })
      }
    } else if (databaseCase && channel === 'app-fork:host' && action === 'configurePhpMyAdminProfile') {
      if (!phpMyAdminCreated || first.rootPassword || first.port !== (first.engine === 'mysql' ? 4406 : 4407)) throw new Error('Incorrect phpMyAdmin profile')
      success({ server: 65536 + first.port })
    } else if (databaseCase && channel === 'App-Node-FN' && action === 'shell' && first === 'openExternalChecked') {
      window.phpMyAdminUrl = second
      if (window.failBrowserOpen) send({ code: 1, msg: 'Fixture browser unavailable' })
      else success()
    } else if (databaseCase && action === 'listLogFiles') {
      const flag = channel.slice('app-fork:'.length)
      success(['error', 'slow'].map((name) => ({ name, path: 'C:/fixture/' + flag + '/data/' + name + '.log', exists: true })))
    } else if (databaseCase && channel === 'App-Node-FN' && action === 'fs') {
      if (first === 'existsSync') send(second.endsWith('/group/group.json'))
      else if (first === 'readFile') send(JSON.stringify([{ id: 'fixture-group', version: fixtureVersion('mysql'), port: 4408, dataDir: 'C:/fixture/mysql/group-db' }]))
      else if (first === 'readLogTail') send('Fixture log read ' + second)
      else if (first === 'mkdirp') send(undefined)
      else if (first === 'writeFile') {
        if (!second.endsWith('/group/group.json')) throw new Error('Wrong MySQL group catalog path')
        window.savedMysqlGroups = JSON.parse(args[3])
        send(true)
      }
    } else if (databaseCase && channel === 'app-fork:mysql' && action === 'startService' && second?.group) {
      if (first.bin !== fixtureVersion('mysql').bin || second.group.id !== 'fixture-group') throw new Error('Group start targeted the wrong instance')
      send({ code: 200 })
      window.finishGroupStart = () => success({ 'APP-Service-Start-PID': '42977' })
    } else if (databaseCase && channel === 'app-fork:mysql' && action === 'stopService' && second?.group) {
      if (!first.bin.endsWith('/group/my-group-fixture-group.cnf') || first.pid !== '42977') throw new Error('Group stop lost its config/PID identity')
      send({ code: 200 })
      window.finishGroupStop = (ok) => ok ? success({ 'APP-Service-Stop-PID': ['42977'] }) : send({ code: 1, msg: 'Group stop denied' })
    } else if (databaseCase && action === 'getDatabasesWithUsers') {
      const flag = channel.slice('app-fork:'.length)
      if (first?.bin !== fixtureVersion(flag).bin || !key.startsWith('IPC-Key-Sensitive-')) throw new Error('Unexpected database target or request kind')
      const created = createdDatabases[flag] || []
      success({
        list: [{ name: flag + '_fixture_catalog', users: ['root'] }, ...created.map((entry) => ({ name: entry.database, users: [entry.user] }))],
        allUsers: [{ User: 'root' }, ...created.map((entry) => ({ User: entry.user }))]
      })
    } else if (databaseCase && action === 'addDatabase') {
      window.databaseMutation = { key, channel, first, second }
      window.finishCreateDatabase = () => {
        const flag = channel.slice('app-fork:'.length)
        ;(createdDatabases[flag] ||= []).push(second)
        success({})
      }
      send({ code: 200 })
    } else if (databaseCase && action === 'backupDatabase') {
      if (channel !== 'app-fork:mysql' || first?.bin !== fixtureVersion('mysql').bin || !key.startsWith('IPC-Key-Sensitive-')) {
        throw new Error('Database backup targeted the wrong binary or request kind')
      }
      if (second.length !== 1 || second[0] !== 'mysql_fixture_catalog' || args[3] !== 'C:/fixture/backup') {
        throw new Error('Invalid backup selection or directory')
      }
      send({ code: 200 })
      window.finishDatabaseBackup = () => success([])
    } else if (databaseCase && channel === 'App-Node-FN' && action === 'dialog' && first === 'showOpenDialog') {
      send({ canceled: false, filePaths: ['C:/fixture/backup'] })
    } else if (databaseCase && channel === 'App-Node-FN' && action === 'shell' && first === 'openPath') {
      if (second !== 'C:/fixture/backup') throw new Error('Opened the wrong backup directory')
      send('Could not open the fixture backup directory')
    } else if (channel === 'app-fork:language-project' && action === 'startService') {
      send({ code: 200, msg: 'Fixture project starting' })
      window.finishProjectStart = () => success({ 'APP-Service-Start-PID': '41730' })
    } else if (channel === 'app-fork:language-project' && action === 'stopService') {
      if (first !== '41730' || second !== 'node') throw new Error('Wrong project PID or kind')
      success(true)
    } else if (channel === 'app-fork:php' && action === 'brewinfo') {
      success([{ name: formula, version: '8.5', installed }])
    } else if (channel === 'app-fork:php' && action === 'portinfo') {
      if (first !== 'php') throw new Error('MacPorts queried the wrong module')
      if (window.failPortRefresh) send({ code: 1, msg: 'MacPorts catalog is offline' })
      else success([
        { name: 'php85', version: '8.5.1', installed: portInstalled },
        { name: '-option', version: '1.0', installed: false }
      ])
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
  const copied = (text) => calls.some(([channel, area, method, value]) =>
    channel === 'App-Node-FN' && area === 'clipboard' && method === 'writeText' && value === text)
  const contains = (value) => document.body.innerText.includes(value)
  await click('Manage packages')
  await wait(() => contains('No direct-download versions'))
  if (called('brewinfo')) throw new Error('Direct source queried Homebrew')
  if (!mac) {
    if (button('Homebrew') || button('Install Homebrew') || button('MacPorts') || called('NodePty:init')) {
      throw new Error('Homebrew is visible on Windows')
    }
    return
  }
  await click('Homebrew')
  await wait(() => called('brewinfo') === 1)
  const first = calls.find(([, action]) => action === 'brewinfo')
  if (first[0] !== 'app-fork:php' || first[2] !== 'php') throw new Error('Wrong catalog request')
  await click('Copy command')
  await wait(() => copied('brew install homebrew/core/php'))
  if (called('packageOperation')) throw new Error('Copy initiated a Homebrew installation')
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
  await wait(() => button('Copy command')?.getAttribute('title') === 'brew uninstall homebrew/core/php')
  await click('Copy command')
  await wait(() => copied('brew uninstall homebrew/core/php'))
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
  await click('Copy tap command')
  await wait(() => copied('brew tap typesense/homebrew-tap'))
  if (called('addTap')) throw new Error('Copy enabled a Homebrew tap')
  await click('Enable tap')
  await wait(() => contains('typesense/tap/typesense-server'))
  await click('Copy command')
  await wait(() => copied('brew install typesense/tap/typesense-server'))
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
const macportsChecks = String.raw`(async () => {
  const button = (label) => [...document.querySelectorAll('button')]
    .find((item) => item.textContent.trim() === label || item.getAttribute('aria-label') === label)
  const contains = (text) => document.body.innerText.includes(text)
  const called = (route) => calls.filter(([channel, action]) => channel === route || action === route).length
  const wait = async (check) => {
    for (let i = 0; i < 400; ++i) {
      if (window.projectErrors?.length) throw new Error(window.projectErrors.join('\n'))
      if (check()) return
      await new Promise((done) => setTimeout(done, 25))
    }
    throw new Error('Timed out: ' + document.body.innerText + '\n' + JSON.stringify(calls))
  }
  const click = async (label) => {
    await wait(() => button(label) && !button(label).disabled)
    button(label).click()
  }
  await click('Manage packages')
  await click('MacPorts')
  await wait(() => contains('php85') && button('Install'))
  if (contains('-option')) throw new Error('Invalid port is visible')
  const select = document.querySelector('.package-toolbar select')
  select.value = 'neo4j'
  select.dispatchEvent(new Event('change', { bubbles: true }))
  await wait(() => !button('MacPorts'))
  if (called('portinfo') !== 1) throw new Error('Unrelated application port detection was queried')
  select.value = 'php'
  select.dispatchEvent(new Event('change', { bubbles: true }))
  await click('MacPorts')
  await wait(() => button('Install') && !button('Install').disabled)
  button('Install').click()
  button('Install').click()
  await wait(() => window.finishPtyInit)
  await click('Stop MacPorts')
  window.finishPtyInit(true)
  await wait(() => contains('MacPorts operation stopped.'))
  if (called('NodePty:init') !== 1 || called('NodePty:exec') || called('NodePty:stop') !== 1) {
    throw new Error('Duplicate start or stop before MacPorts began')
  }

  await click('Install')
  await wait(() => window.finishPtyInit)
  window.finishPtyInit(true)
  await wait(() => window.finishPtyExec)
  await click('Close package library')
  await click('Manage packages')
  await wait(() => contains('MacPorts is working…') && document.querySelector('.port-terminal .xterm'))
  if (called('NodePty:exec') !== 1 || called('NodePty:init') !== 2) throw new Error('Reopening restarted MacPorts')
  window.failPortRefresh = true
  window.finishPtyExec(0)
  await wait(() => contains('MacPorts operation completed.') && contains('MacPorts catalog is offline'))
  if (!button('Uninstall') || window.terminalHasOutputListener()) throw new Error('MacPorts lost the committed result or kept a terminal listener')
  window.failPortRefresh = false
  await click('Refresh')
  await click('Uninstall')
  if (called('NodePty:exec') !== 1) throw new Error('Uninstall ran without confirmation')
  await click('Confirm uninstall')
  await wait(() => window.finishPtyInit)
  window.finishPtyInit(true)
  await wait(() => window.finishPtyExec)
  window.finishPtyExec(17)
  await wait(() => contains('Terminal exited with code 17') && button('Uninstall') && !button('Uninstall').disabled)
  if (window.terminalHasOutputListener()) throw new Error('Failed MacPorts command kept a terminal listener')
})()`
const databaseChecks = String.raw`(async () => {
  const button = (label, parent = document) => [...parent.querySelectorAll('button')]
    .find((item) => item.textContent.trim() === label || item.getAttribute('aria-label') === label)
  const wait = async (check) => {
    for (let i = 0; i < 400; ++i) {
      if (window.projectErrors?.length) throw new Error(window.projectErrors.join('\n'))
      if (check()) return
      await new Promise((done) => setTimeout(done, 25))
    }
    throw new Error('Database UI timed out: ' + document.body.innerText.slice(-2000))
  }
  const click = async (label, parent) => {
    await wait(() => button(label, parent) && !button(label, parent).disabled)
    button(label, parent).click()
  }
  const manager = () => document.querySelector('.pqt-database-manage-surface .el-drawer')
  const form = () => document.querySelector('.pqt-established-detached-tool .el-dialog')
  const chooseEngine = (label) => [...document.querySelectorAll('.database-item')]
    .find((item) => item.innerText.includes(label)).click()
  await wait(() => button('Manage databases') && !button('Manage databases').disabled)
  button('Manage databases').click()
  button('Manage databases').click()
  await wait(() => manager()?.innerText.includes('mysql_fixture_catalog'))
  if (document.querySelectorAll('.pqt-database-manage-surface .el-drawer').length !== 1) throw new Error('Manage opened more than one drawer')
  await click('root password', manager())
  await wait(() => form()?.querySelector('input'))
  form().querySelector('.el-dialog__headerbtn').click()
  await wait(() => !form())
  await click('Add database', manager())
  await wait(() => form()?.querySelector('input'))
  const name = form().querySelector('input[placeholder="Please enter database name"]')
  name.value = 'fixture_created'
  name.dispatchEvent(new Event('input', { bubbles: true }))
  await click('OK', form())
  await wait(() => window.finishCreateDatabase)
  const target = window.databaseMutation
  if (target.channel !== 'app-fork:mysql' || target.first.bin !== 'C:/fixture/mysql/bin/mysqld.exe' ||
      !target.key.startsWith('IPC-Key-Sensitive-') || target.second.database !== 'fixture_created' ||
      target.second.user !== 'fixture_created' || target.second.charset !== 'utf8mb4') {
    throw new Error('Database creation lost its engine or submitted values')
  }
  if (!button('OK', form())?.disabled || manager().innerText.includes('fixture_created')) {
    throw new Error('Database creation treated progress as completion')
  }
  form().querySelector('.el-dialog__headerbtn').click()
  await wait(() => !form())
  await click('Close database management', manager())
  await wait(() => !manager())
  chooseEngine('MariaDB')
  await click('Manage databases')
  await wait(() => manager()?.innerText.includes('mariadb_fixture_catalog'))
  if (manager().innerText.includes('mysql_fixture_catalog')) throw new Error('MySQL catalog leaked into MariaDB')
  window.finishCreateDatabase()
  await wait(() => calls.filter((entry) => entry[0] === 'app-fork:mysql' && entry[1] === 'getDatabasesWithUsers').length === 2)
  if (manager().innerText.includes('fixture_created')) throw new Error('MySQL completion changed the MariaDB catalog')
  await click('Close database management', manager())
  await wait(() => !manager())
  chooseEngine('MySQL')
  await click('Manage databases')
  await wait(() => manager()?.innerText.includes('fixture_created'))
  const catalogRow = [...manager().querySelectorAll('tbody tr')]
    .find((row) => row.innerText.includes('mysql_fixture_catalog'))
  catalogRow.querySelector('input[type=checkbox]').click()
  await click('Database backup', manager())
  await wait(() => window.finishDatabaseBackup && manager()?.querySelector('.el-loading-mask'))
  window.finishDatabaseBackup()
  await wait(() => !manager()?.querySelector('.el-loading-mask') &&
    document.body.innerText.includes('Could not open the fixture backup directory'))
  await click('Close database management', manager())
  await wait(() => !manager())
  const forge = () => [...document.querySelectorAll('.forge-dialog')].at(-1)
  const phpMyAdminCount = (action) => calls.filter(([, method]) => method === action).length
  chooseEngine('MySQL')
  window.failBrowserOpen = true
  await click('Open phpMyAdmin')
  await wait(() => document.body.innerText.includes('Setting up phpMyAdmin (32%)') && window.finishPhpMyAdmin)
  if (phpMyAdminCount('configurePhpMyAdminProfile')) throw new Error('Profile setup ran before site creation completed')
  const workspace = (label) => [...document.querySelectorAll('.sidebar .nav-item')]
    .find((item) => item.querySelector('span:nth-child(2)')?.textContent === label)
  workspace('Websites').click()
  await wait(() => document.querySelector('h1')?.innerText === 'Websites')
  workspace('Databases').click()
  await wait(() => document.body.innerText.includes('Setting up phpMyAdmin (32%)'))
  window.finishPhpMyAdmin()
  await wait(() => document.body.innerText.includes('The database profile is ready. Open https://phpmyadmin.test:4443/?server=69942'))
  if (window.phpMyAdminUrl !== 'https://phpmyadmin.test:4443/?server=69942') throw new Error('Wrong MySQL phpMyAdmin URL')
  window.failBrowserOpen = false
  chooseEngine('MariaDB')
  await click('Open phpMyAdmin')
  await wait(() => document.body.innerText.includes('phpMyAdmin opened for MariaDB'))
  if (window.phpMyAdminUrl !== 'https://phpmyadmin.test:4443/?server=69943' || phpMyAdminCount('addPhpMyAdminSite') !== 1) {
    throw new Error('Switching engines selected the wrong profile or repeated the completed setup')
  }
  for (const [engine, flag] of [['MySQL', 'mysql'], ['MariaDB', 'mariadb']]) {
    chooseEngine(engine)
    await click('Slow query log')
    await wait(() => forge()?.innerText.includes('Fixture log read C:/fixture/' + flag + '/data/slow.log'))
    if (forge().innerText.includes('/data/error.log')) throw new Error('Slow log route showed the error log')
    await click('Close dialog', forge())
    await wait(() => !forge())
  }
  chooseEngine('MySQL')
  await click('MySQL instance groups')
  await wait(() => forge()?.innerText.includes('fixture-group'))
  button('Start', forge()).click()
  await wait(() => forge()?.innerText.includes('Working…') && window.finishGroupStart)
  await click('Close dialog', forge())
  await click('MySQL instance groups')
  await wait(() => forge()?.innerText.includes('Working…'))
  if (calls.filter(([, method, , options]) => method === 'startService' && options?.group).length !== 1) throw new Error('Group start repeated across reopen')
  window.finishGroupStart()
  await wait(() => forge()?.innerText.includes('Running'))
  await click('Logs', forge())
  await wait(() => forge()?.innerText.includes('my-group-fixture-group-error.log'))
  const slow = [...forge().querySelectorAll('.service-file-item')].find((item) => item.innerText.includes('Slow query log'))
  slow.click()
  await wait(() => forge()?.innerText.includes('Fixture log read C:/fixture/mysql/data/group/my-group-fixture-group-slow.log'))
  await click('Close dialog', forge())
  await click('Remove', forge())
  await click('Remove group', forge())
  await wait(() => window.finishGroupStop)
  window.finishGroupStop(false)
  await wait(() => document.body.innerText.includes('Group stop denied') && !button('Remove group', forge()).disabled)
  if (window.savedMysqlGroups) throw new Error('Removing the group wrote its catalog after a failed stop')
  window.finishGroupStop = undefined
  await click('Remove group', forge())
  await wait(() => window.finishGroupStop)
  window.finishGroupStop(true)
  await wait(() => forge()?.innerText.includes('No saved MySQL instance groups.') && window.savedMysqlGroups?.length === 0)
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
const terminalErrorCheck = `(async () => {
  await new Promise((done) => setTimeout(done, 80))
  if (window.projectErrors.length) throw new Error(window.projectErrors.join(' '))
})()`
const directChecks = String.raw`(async () => {
  const button = (label) => [...document.querySelectorAll('.package-launcher, .package-dialog button')]
    .find((item) => item.textContent.trim() === label || item.getAttribute('aria-label') === label)
  const wait = async (read, label) => {
    for (let i = 0; i < 400; ++i) {
      if (window.projectErrors.length) throw new Error(window.projectErrors.join('\n'))
      const found = read()
      if (found) return found
      await new Promise((done) => setTimeout(done, 25))
    }
    throw new Error(label + ' · ' + document.body.innerText)
  }
  const rows = () => [...document.querySelectorAll('.package-row .package-version b')].map((row) => row.textContent)
  const copies = () => calls.filter(([channel, area, method]) =>
    channel === 'App-Node-FN' && area === 'clipboard' && method === 'writeText')
  const notice = () => document.querySelector('#fixture-notice').textContent
  ;(await wait(() => button('Manage packages'), 'Package library launcher')).click()
  const select = await wait(() => document.querySelector('.package-toolbar select'), 'Package selector')
  if (button('Stable') || button('Beta')) throw new Error('Flutter release filters appeared for PHP')
  select.value = 'flutter'
  select.dispatchEvent(new Event('change', { bubbles: true }))
  await wait(() => rows().join() === '3.38.2', 'Stable-only rows')
  if (button('Stable').getAttribute('aria-pressed') !== 'true') throw new Error('Stable is not selected')
  button('Beta').click()
  await wait(() => rows().join() === '3.39.0-0.1.pre', 'Beta-only rows')
  const query = document.querySelector('.package-search input')
  query.value = '3.38'
  query.dispatchEvent(new Event('input', { bubbles: true }))
  await wait(() => document.querySelector('.package-table').textContent.includes('No versions match'), 'Combined channel and text filter')
  query.value = ''
  query.dispatchEvent(new Event('input', { bubbles: true }))
  ;(await wait(() => button('Copy download URL'), 'Copy selected release URL')).click()
  await wait(() => notice() === 'Download URL copied.', 'Clipboard confirmation')
  if (copies().length !== 1 || copies()[0][3] !== flutterFixtureUrls.beta) throw new Error('Copied the wrong release URL or wrote it more than once')
  if (calls.some(([, method]) => method === 'installSoft')) throw new Error('Copy started a download')
  window.failFixtureCopy = true
  button('Copy download URL').click()
  await wait(() => notice() === 'The clipboard did not confirm the copy.', 'Clipboard failure notice')
  if (calls.filter(([channel, method]) => channel === 'app-fork:flutter' && method === 'fetchAllOnlineVersion').length !== 1) {
    throw new Error('Changing channels refetched the package list')
  }
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
  import { nextAppState } from './state/app'
  import './styles/app.css'
  import './styles/websites.css'
  window.Server = reactive(window.Server)
  window.terminalHasOutputListener = () => !!IPC.listens['NodePty:data:fixture-pty']
  let component = PackageBrowser
  if (location.search === '?projects' || location.search === '?database') {
    const { default: localForage } = await import('localforage')
    const { applyLanguagePayload } = await import('../lang/runtime.ts')
    const messages = {}
    for (const [path, load] of Object.entries(import.meta.glob('../lang/en/*.json', { import: 'default' }))) {
      messages[path.split('/').pop().replace('.json', '')] = await load()
    }
    applyLanguagePayload({ locale: 'en', fallbackLocale: 'en', messages, fallbackMessages: messages })
    if (location.search === '?database') {
      const { nextAppState } = await import('./state/app.ts')
      nextAppState.workspace = 'databases'
      component = (await import('./AppNext.vue')).default
    } else {
    for (const [kind, label] of [['php', 'PHP'], ['node', 'Node'], ['python', 'Python'], ['golang', 'Go']]) {
      await localForage.setItem('qtenvdev-' + kind + '-projects', [{
        id: 'saved-' + kind, typeFlag: kind, path: 'C:/fixture/' + kind + '-project',
        comment: 'Saved ' + label + ' fixture', runCommand: 'npm run dev', projectPort: 4173,
        additionalProjectPorts: [5173], isService: true, binVersion: ''
      }])
    }
    component = (await import('./components/ProjectWorkflowPanel.vue')).default
    }
  }
  const app = createApp({ render: () => [
    h(component, component === PackageBrowser ? { flag: 'php' } : undefined),
    location.search === '?direct' ? h('output', { id: 'fixture-notice' }, nextAppState.toast) : null
  ] }).use(createPinia())
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
  await win.loadURL(${JSON.stringify(url)} + '?direct')
  await win.webContents.executeJavaScript(${JSON.stringify(directChecks)})
  await win.loadURL(${JSON.stringify(url)} + '?bootstrap')
  await win.webContents.executeJavaScript(${JSON.stringify(bootstrapChecks)})
  await win.webContents.executeJavaScript(${JSON.stringify(terminalErrorCheck)})
  await win.loadURL(${JSON.stringify(url)} + '?ports')
  await win.webContents.executeJavaScript(${JSON.stringify(macportsChecks)})
  await win.webContents.executeJavaScript(${JSON.stringify(terminalErrorCheck)})
  await win.loadURL(${JSON.stringify(url)} + '?projects')
  await win.webContents.executeJavaScript(${JSON.stringify(projectChecks)})
  await win.loadURL(${JSON.stringify(url)} + '?database')
  await win.webContents.executeJavaScript(${JSON.stringify(databaseChecks)})
  app.exit(0)
}).catch((error) => { console.error(error); app.exit(1) })
setTimeout(() => app.exit(2), 120000)`
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
  console.log('Direct package UI passed: Flutter channel filters, exact download URL and clipboard results.')
  console.log('MacPorts Electron UI passed: supported-module gating, safe command routing, confirmation, duplicate protection, stop during setup, reopen, terminal exit, and refresh failure.')
  console.log('Database management Electron UI passed: engine selection, create across close, backup completion, selected-version phpMyAdmin opening, bounded slow logs, and MySQL instance group lifecycle and removal.')
  console.log(
    'Language projects Electron UI passed: PHP, Node.js, Python and Go saved projects and first-click scaffold forms; start progress, live PID retention across refresh, and stop through fixture IPC.'
  )
} finally {
  await server.close()
  await rm(fixture, { force: true })
  await rm(directory, { recursive: true, force: true })
}
