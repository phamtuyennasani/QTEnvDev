import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electron from 'electron'
import { createServer } from 'vite'
import viteConfig from '../configs/vite.config'

// Mount the real Websites screen, controllers and adapters in a hidden Electron
// window. The transport owns fixture host records and files, and never touches OS hosts.
const temporary = await mkdtemp(join(tmpdir(), 'pqt-websites-ui-'))
const fixtureName = `.websites-ui-${process.pid}.html`
const fixturePath = resolve('src/render-next', fixtureName)
const terminalModule = resolve('src/render/util/XTerm.ts').replaceAll('\\', '/')
const server = await createServer({
  ...viteConfig.serverConfig,
  configFile: false,
  server: { port: 0, host: '127.0.0.1', hmr: false, watch: null },
  plugins: [...(viteConfig.serverConfig.plugins ?? []), {
    name: 'websites-ui-terminal-fixture',
    enforce: 'pre',
    load(id) {
      if (id.replaceAll('\\', '/') === terminalModule) {
        // Keep the real PHP creation controller and its completion flow. This
        // adapter records terminal requests without starting a renderer or a PTY.
        return `
          export default class XTerm {
            async mount(dom) { this.dom = dom }
            async send(commands) { window.websiteTerminalCommands.push(commands) }
            unmounted() { this.dom = undefined }
            destroy() { this.unmounted() }
          }
        `
      }
      return undefined
    }
  }]
})

const bootstrap = String.raw`
  window.Server = { isWindows: true, DataDirectoryReady: true, BaseDir: 'C:/fixture/', AppDir: 'C:/fixture/' }
  window.websiteErrors = []
  window.websiteRequests = []
  window.websiteTerminalCommands = []
  window.addEventListener('error', (event) => websiteErrors.push(String(event.error || event.message)))
  window.addEventListener('unhandledrejection', (event) => websiteErrors.push(String(event.reason)))
  const vhost = 'C:/fixture/vhost/nginx/1.conf'
  const tomcatConf = 'C:/fixture/catalina/conf/'
  window.websiteFiles = {
    [vhost]: 'server { listen 8080; }\n',
    'C:/fixture/app.hosts.txt': '127.0.0.1     alpha.fixture.test\n127.0.0.1     alias.fixture.test',
    [tomcatConf + 'server.xml']: '<Server port="8005" />',
    [tomcatConf + 'Catalina/java.fixture.test/rewrite.config']: 'RewriteRule ^/old /new [L]',
    'C:/fixture/vhost/logs/java.fixture.test-tomcat_access_log.2026-11-19.log': 'fixture Tomcat access log'
  }
  const cronJobs = [
    { id: 'alpha', name: 'Alpha task', scope: 'host', hostId: 1, schedule: '0 * * * *', command: 'fixture-alpha', enabled: true },
    { id: 'beta', name: 'Beta task', scope: 'host', hostId: 2, schedule: '0 0 * * *', command: 'fixture-beta', enabled: true },
    { id: 'global', name: 'Global task', scope: 'global', schedule: '0 0 * * *', command: 'fixture-global', enabled: true }
  ]
  let systemTaskExists = true
  let receive
  let reorderIndex = 0
  const orderResponses = [
    { action: 'pin', id: 2, before: [1, 2, 3], after: [2, 1, 3], pinned: true },
    { action: 'down', id: 1, before: [2, 1, 3], after: [2, 3, 1] },
    { action: 'unpin', id: 2, before: [2, 3, 1], after: [2, 3, 1], pinned: false }
  ]
  const snapshot = () => ({ host: JSON.parse(JSON.stringify(window.websiteHosts)) })
  window.QTEnvDevNodeAPI = {
    ipcReceiveFromMain(listener) { receive = listener },
    ipcSendToMain(channel, key, ...args) {
      websiteRequests.push([channel, ...JSON.parse(JSON.stringify(args))])
      const reply = (data) => queueMicrotask(() => receive({}, channel, key, data))
      const success = (data) => reply({ code: 0, data })
      const failure = (msg) => reply({ code: 1, msg })
      const [method, first, second, third, fourth, fifth] = args
      if (channel === 'app-fork:cron') {
        if (method === 'getCronJobs') return success(cronJobs)
        if (method === 'runCommand' && first === 'C:/fixture/beta' && second === 'fixture-test') return success({ exitCode: 0, duration: 1, output: 'Draft command passed', error: '' })
        if (method === 'listRunRecords' && first === 'beta' && second === 20) return success([{ id: 'run1', jobId: 'beta', startedAt: 1, finishedAt: 20, duration: 19, exitCode: 4, error: 'Beta fixture output' }])
        if (method === 'listSystemTasks') return success(systemTaskExists ? [{ id: 'fixture-task', name: 'Fixture scheduler task', fullName: 'Fixture scheduler task', platform: 'windows', schedule: 'Daily' }] : [])
        if (method === 'deleteSystemTask' && first === 'fixture-task' && systemTaskExists) {
          systemTaskExists = false
          return success(true)
        }
        return failure('Unexpected scheduler mutation: ' + method)
      }
      if (channel === 'app-fork:version' && method === 'allInstalledVersions') {
        return success(Object.fromEntries(first.filter((flag) => flag === 'php' || flag === 'composer').map((flag) => [flag, []])))
      }
      if (channel === 'app-fork:project' && method === 'handleProjectDir') {
        if (first !== 'C:/fixture/laravel' || second !== 'laravel') return failure('Wrong generated project directory')
        return success(true)
      }
      if (channel === 'app-fork:host') {
        if (method === 'hostList') return success(snapshot())
        if (method === 'handleHost') {
          if (second !== 'park' || first.name !== 'alpha.fixture.test' || third.id !== first.id) return failure('Unexpected park request')
          websiteHosts.push({ ...first, id: 5, name: 'blog.alpha.fixture.test', root: first.root + '/blog' })
          return success({ ...snapshot(), parked: { count: 1, warnings: ['Skipped another folder'] } })
        }
        if (method === 'websiteBackupExport') {
          if (first !== 'C:/fixture-export/website-backup.json') return failure('Wrong export destination')
          return success({ count: websiteHosts.length, warnings: [] })
        }
        if (method === 'websiteBackupPreview') {
          if (first !== 'C:/fixture-export/website-backup.json') return failure('Wrong backup source')
          return success({ token: 'example-token', sites: [{ id: '4', name: 'restored.fixture.test', root: 'C:/fixture/restored', type: 'php' }], warnings: ['Fixture preview warning'] })
        }
        if (method === 'websiteBackupImport') {
          if (first !== 'C:/fixture-export/website-backup.json' || second !== 'example-token') return failure('Wrong import snapshot')
          window.finishWebsiteImport = () => {
            websiteHosts.push({ ...websiteHosts[0], id: 4, name: 'restored.fixture.test', root: 'C:/fixture/restored' })
            success({ ...snapshot(), outcome: 'committed', count: 1, warnings: [] })
          }
          return reply({ code: 200, msg: 'Writing fixture configuration…' })
        }
        if (method === 'reorderHost') {
          const expected = orderResponses[reorderIndex++]
          if (!expected || first !== expected.id || third !== expected.action || JSON.stringify(second) !== JSON.stringify(expected.before)) {
            return failure('Website order request does not match the authoritative fixture order.')
          }
          const host = websiteHosts.find((item) => item.id === first)
          if ('pinned' in expected) host.isTop = expected.pinned
          window.websiteHosts = expected.after.map((id) => websiteHosts.find((item) => item.id === id))
          return success(snapshot())
        }
        if (method === 'writeHosts') return success(true)
        return failure('Unexpected host command: ' + method)
      }
      if (channel === 'app-fork:tomcat' && method === 'saveSite') {
        const host = third
        if (first.bin !== 'C:/fixture/tomcat/bin/catalina.bat' || second !== 'C:/fixture/catalina' || host.type !== 'tomcat') {
          return failure('Tomcat fixture received the wrong version, Catalina base, or host type.')
        }
        if (fourth === 'add') websiteHosts.push(host)
        else if (fourth === 'edit' || fourth === 'del') {
          const index = websiteHosts.findIndex((item) => item.id === host.id)
          if (index < 0 || JSON.stringify(websiteHosts[index]) !== JSON.stringify(fifth)) return failure('Wrong prior Tomcat record.')
          if (fourth === 'edit') websiteHosts.splice(index, 1, host)
          else websiteHosts.splice(index, 1)
        } else return failure('Unexpected Tomcat action: ' + fourth)
        return success(snapshot())
      }
      if (channel === 'App-Node-FN') {
        if (method === 'dialog' && first === 'showSaveDialog') {
          return reply({ canceled: false, filePath: 'C:/fixture-export/website-backup.json' })
        }
        if (method === 'dialog' && first === 'showOpenDialog') {
          return reply({ canceled: false, filePaths: [second?.filters?.[0]?.name === 'Website backup' ? 'C:/fixture-export/website-backup.json' : 'C:/fixture/laravel'] })
        }
        if (method === 'fs') {
          if (first === 'existsSync') return reply(second in websiteFiles || second === 'C:/fixture/webapps' || second === 'C:/fixture/vhost/logs')
          if (first === 'stat') return reply({ isDirectory: second === 'C:/fixture/webapps' })
          if (first === 'subdir') return reply(second === 'C:/fixture/webapps' ? ['ROOT', 'console'] : [])
          if (first === 'readdir') {
            if (second === 'C:/fixture/webapps') return reply(['console.war', 'api.war', 'README.txt'])
            return reply(['java.fixture.test-tomcat_access_log.2026-11-19.log', 'java.fixture.test-tomcat_access_log.2026-11-19.log.bak', 'another-tomcat_access_log.log'])
          }
          if (first === 'readFile' || first === 'readLogTail') return reply(websiteFiles[second] ?? { code: 1, msg: 'Fixture file missing' })
          if (first === 'writeFile') {
            if (second !== vhost) return reply({ code: 1, msg: 'Unexpected fixture write path' })
            websiteFiles[second] = third
            return reply(true)
          }
        }
        return reply(true)
      }
      return success([])
    }
  }
`

const mount = String.raw`
  import { createApp, h } from 'vue'
  import { createPinia, setActivePinia } from 'pinia'
  import localForage from 'localforage'
  import WebsitesScreen from './screens/WebsitesScreen.vue'
  import CronScreen from './screens/CronScreen.vue'
  import { navigateNext, nextAppState } from './state/app'
  import { newWebsite } from './websites/model'
  import { BrewStore } from '../render/store/brew'
  import { applyLanguagePayload } from '../lang/runtime'
  import base from '../lang/en/base.json'
  import host from '../lang/en/host.json'
  import './styles/app.css'
  import './styles/websites.css'

  const messages = { base, host }
  applyLanguagePayload({ locale: 'en', fallbackLocale: 'en', messages, fallbackMessages: messages })
  window.websiteHosts = ['alpha', 'beta', 'gamma'].map((name, index) => ({
    ...newWebsite(), id: index + 1, name: name + '.fixture.test', root: 'C:/fixture/' + name,
    alias: index === 0 ? 'alias.fixture.test' : ''
  }))
  const pinia = createPinia()
  setActivePinia(pinia)
  const tomcatBin = 'C:/fixture/tomcat/bin/catalina.bat'
  await localForage.setItem('qtenvdev-tomcat-server-root', { [tomcatBin]: 'C:/fixture/catalina' })
  window.websiteRestarts = []
  const restart = (name) => async () => { websiteRestarts.push(name); return true }
  BrewStore().module('tomcat').installed = [{
    version: '10.1.49', path: 'C:/fixture/tomcat', bin: tomcatBin, typeFlag: 'tomcat', run: true,
    running: false, restart: restart('tomcat')
  }]
  BrewStore().module('nginx').installed = [{ run: true, running: false, restart: restart('nginx') }]
  navigateNext('websites')
  const app = createApp({
    render: () => h('main', [
      h('button', { onClick: () => navigateNext('websites') }, 'Websites'),
      h('p', { role: 'status' }, nextAppState.toast),
      h(nextAppState.workspace === 'cron' ? CronScreen : WebsitesScreen)
    ])
  }).use(pinia)
  app.config.errorHandler = (error) => websiteErrors.push(error?.stack ?? String(error))
  app.mount('#app')
`

const checks = String.raw`(async () => {
  const assert = (condition, message) => { if (!condition) throw new Error(message) }
  const wait = async (condition, label) => {
    for (let attempt = 0; attempt < 480; attempt++) {
      if (websiteErrors.length) throw new Error(websiteErrors.join('\n'))
      if (condition()) return
      await new Promise((done) => setTimeout(done, 25))
    }
    throw new Error('Timed out waiting for ' + label + '\n' + document.body.innerText.slice(0, 1800))
  }
  const modal = () => document.querySelector('[role=dialog]')
  const button = (label, root = modal() ?? document) => [...root.querySelectorAll('button')]
    .find((element) => element.textContent.trim() === label || element.getAttribute('aria-label') === label)
  const click = async (label) => {
    await wait(() => button(label) && !button(label).disabled, label)
    button(label).click()
  }
  const input = (element, value) => { element.value = value; element.dispatchEvent(new Event('input', { bubbles: true })) }
  const field = (label) => [...modal().querySelectorAll('label')]
    .find((element) => element.textContent.trim().startsWith(label))?.querySelector('input, textarea')
  const order = () => [...document.querySelectorAll('.project-item small')].map((item) => item.textContent.split('.')[0]).join(',')
  const select = async (domain) => {
    const item = () => [...document.querySelectorAll('.project-item')].find((element) => element.querySelector('small')?.textContent === domain)
    await wait(item, domain)
    item().click()
    await wait(() => document.querySelector('.detail-kind')?.textContent === domain, 'selected ' + domain)
  }
  const requests = (channel, method) => websiteRequests.filter((entry) => entry[0] === channel && entry[1] === method)
  await select('beta.fixture.test')
  await click('Pin')
  await wait(() => order() === 'beta,alpha,gamma' && document.querySelector('.project-badge')?.textContent === 'Pinned', 'pin and authoritative order')
  assert(button('Move down').disabled, 'A pinned website must not move into the unpinned group')
  await select('alpha.fixture.test')
  await click('Move down')
  await wait(() => order() === 'beta,gamma,alpha', 'move within unpinned group')
  await select('beta.fixture.test')
  await click('Unpin')
  await wait(() => !document.querySelector('.project-badge') && order() === 'beta,gamma,alpha', 'unpin and save')
  const sort = document.querySelector('.website-sort select')
  sort.value = 'domain'
  sort.dispatchEvent(new Event('change', { bubbles: true }))
  await wait(() => order() === 'alpha,beta,gamma' && !button('Move up'), 'domain sort hides manual ordering')
  assert(requests('app-fork:host', 'reorderHost').length === 3, 'Expected exactly three deliberate order writes')
  assert(!requests('app-fork:host', 'writeHosts').length, 'Reordering should not write system hosts')

  await select('alpha.fixture.test')
  await click('Vhost / rewrite files ↗')
  await wait(() => modal()?.querySelector('textarea')?.value.includes('listen 8080'), 'generated Nginx configuration')
  const editor = modal().querySelector('textarea')
  const updated = 'server { listen 8081; }\n'
  assert(button('Save configuration').disabled, 'Unchanged configuration should not enable save')
  input(editor, updated)
  const vhost = 'C:/fixture/vhost/nginx/1.conf'
  websiteFiles[vhost] = 'external edit\n'
  await click('Save configuration')
  await wait(() => modal()?.innerText.includes('changed outside this editor'), 'external vhost edit conflict')
  assert(!requests('App-Node-FN', 'fs').some((entry) => entry[2] === 'writeFile'), 'External changes must be preserved')
  await click('Refresh')
  await wait(() => editor.value === 'external edit\n', 'reload external edit')
  input(editor, updated)
  await click('Save configuration')
  await wait(() => modal()?.innerText.includes('Configuration saved.'), 'generated configuration saved')
  assert(websiteFiles[vhost] === updated && websiteRestarts.join(',') === 'nginx', 'Vhost should reload only its running server')
  await click('Close')

  await click('Configure')
  await click('SSL')
  field('Enable HTTPS').click()
  await wait(() => modal()?.querySelector('.local-certificate-help summary'), 'automatic certificate help')
  modal().querySelector('.local-certificate-help summary').click()
  await click('Copy PowerShell command')
  await wait(() => document.querySelector('#app [role=status]')?.textContent.includes('local CA certificate is unavailable'), 'missing local certificate')
  const publicCertificate = 'C:/fixture/CA/QTEnvDev-Root-CA.crt'
  websiteFiles[publicCertificate] = 'public fixture certificate'
  await click('Show root certificate')
  await wait(() => requests('App-Node-FN', 'shell').some((entry) => entry[2] === 'showItemInFolder' && entry[3] === publicCertificate), 'show public root certificate')
  await click('Copy PowerShell command')
  await wait(() => requests('App-Node-FN', 'clipboard').some((entry) => entry[2] === 'writeText' && entry[3] === "certutil.exe -addstore Root 'C:\\fixture\\CA\\QTEnvDev-Root-CA.crt'"), 'copy the exact root certificate command')
  await click('Close')

  await click('New Tomcat website')
  await wait(() => modal()?.querySelector('h2')?.textContent === 'New Tomcat website', 'dedicated Tomcat create dialog')
  input(field('Hostname'), 'java.fixture.test')
  input(field('App base directory'), 'C:/fixture/webapps')
  input(field('Tomcat port'), '8089')
  await click('Scan')
  await wait(() => modal()?.innerText.includes('Added 3 context mappings.'), 'Tomcat app base scan')
  const contexts = () => [...modal().querySelectorAll('.context-row')].map((row) => [...row.querySelectorAll('input')].map((item) => item.value))
  assert(JSON.stringify(contexts()) === JSON.stringify([
    ['/', 'C:/fixture/webapps/ROOT'], ['/api', 'C:/fixture/webapps/api.war'], ['/console', 'C:/fixture/webapps/console']
  ]), 'Scan should map ROOT, WARs and exploded applications without duplicates')
  field('Enable rewrite rules').click()
  await wait(() => field('Rewrite rules'), 'rewrite textarea')
  input(field('Rewrite rules'), 'RewriteRule ^/old /new [L]')
  await click('Save website')
  await wait(() => !modal() && document.querySelector('.detail-kind')?.textContent === 'java.fixture.test', 'Tomcat create result')
  const added = requests('app-fork:tomcat', 'saveSite')[0]
  assert(added[5] === 'add' && added[4].port.tomcat === 8089 && added[4].tomcat.contexts.length === 3, 'Tomcat add must carry runtime version, Catalina base, port and context mappings')
  assert(!requests('app-fork:host', 'handleHost').length, 'The generic host writer must not receive Tomcat changes')
  await click('Open site ↗')
  await wait(() => requests('App-Node-FN', 'shell').some((entry) => entry[2] === 'openExternal' && entry[3] === 'http://java.fixture.test:8089/'), 'Tomcat endpoint')

  await click('Configure')
  await wait(() => modal()?.querySelector('h2')?.textContent === 'Configure Tomcat website', 'dedicated Tomcat edit dialog')
  assert(contexts().length === 3 && field('Rewrite rules').value.includes('RewriteRule'), 'Tomcat settings must reopen with saved mappings and rewrite rules')
  input(field('Comment'), 'Edited Tomcat fixture')
  await click('Save website')
  await wait(() => !modal() && requests('app-fork:tomcat', 'saveSite').length === 2, 'Tomcat edit completed')
  assert(requests('app-fork:tomcat', 'saveSite')[1][5] === 'edit', 'Tomcat edit must use saveSite')

  await click('Vhost / rewrite files ↗')
  await wait(() => modal()?.querySelector('textarea')?.value.includes('<Server'), 'Tomcat server.xml view')
  assert(modal().querySelector('textarea').readOnly && !button('Save configuration'), 'Tomcat server.xml should be read only in generated-file viewer')
  modal().querySelectorAll('.service-file-item')[1].click()
  await wait(() => modal()?.querySelector('textarea')?.value.includes('RewriteRule'), 'Tomcat generated rewrite view')
  assert(modal().querySelectorAll('.service-file-item').length === 2 && modal().querySelector('textarea').readOnly, 'Tomcat should list its own read-only generated files')
  await click('Close')
  await click('Host log files ↗')
  await wait(() => modal()?.querySelector('pre')?.textContent.includes('fixture Tomcat access log'), 'Tomcat log preview')
  assert(modal().querySelectorAll('.service-file-item').length === 1, 'Tomcat logs should exclude sibling hosts and backups')
  await click('Close')

  await click('Remove website')
  await wait(() => modal()?.querySelector('input'), 'Tomcat delete confirmation')
  assert(button('Remove configuration').disabled, 'Exact hostname confirmation is required')
  input(modal().querySelector('input'), 'java.fixture.test')
  await click('Remove configuration')
  await wait(() => !modal() && !document.querySelector('.project-list-panel')?.innerText.includes('java.fixture.test'), 'Tomcat delete completed')
  assert(requests('app-fork:tomcat', 'saveSite')[2][5] === 'del', 'Tomcat deletion must use saveSite')
  assert(requests('app-fork:host', 'writeHosts').length === 3, 'Each Tomcat commit should synchronize system hosts once')
  assert(websiteRestarts.join(',') === 'nginx,tomcat,tomcat,tomcat', 'Each Tomcat commit should restart only the running Tomcat version')

  await select('beta.fixture.test')
  await click('Scheduled tasks ↗')
  const taskNames = () => [...document.querySelectorAll('.cron-copy b')].map((item) => item.textContent).join(',')
  await wait(() => document.body.innerText.includes('Website: beta.fixture.test') && taskNames() === 'Beta task', 'website-scoped scheduled tasks')
  await click('+ New task')
  await wait(() => modal()?.querySelector('h2')?.textContent === 'New task', 'new website task')
  const taskSelects = modal().querySelectorAll('select')
  assert(taskSelects[0].value === 'host' && taskSelects[1].value === '2', 'New task must select the originating website')
  assert(field('Working directory').value === 'C:/fixture/beta', 'New task must use the originating website root')
  input(field('Command'), 'fixture-test')
  await click('Test command now')
  await wait(() => modal()?.innerText.includes('Draft command passed'), 'draft command result')
  assert(requests('app-fork:cron', 'runCommand').length === 1 && !requests('app-fork:cron', 'addCronJob').length, 'A draft run must not save the task')
  await click('Cancel')
  await click('Run history')
  await wait(() => modal()?.innerText.includes('Beta fixture output'), 'website task run history')
  await click('Close dialog')
  await click('Show all tasks')
  await wait(() => taskNames() === 'Alpha task,Beta task,Global task' && !document.body.innerText.includes('Website: beta.fixture.test'), 'cleared task scope')
  await click('System scheduler')
  await wait(() => taskNames() === 'Fixture scheduler task', 'system scheduler fixture row')
  await click('Delete')
  await wait(() => modal()?.innerText.includes('Fixture scheduler task'), 'exact system task confirmation')
  assert(!requests('app-fork:cron', 'deleteSystemTask').length, 'Opening the dialog must not delete the task')
  await click('Delete system task')
  await wait(() => !modal() && document.body.innerText.includes('System task removed.') && !taskNames(), 'system task deletion')
  assert(requests('app-fork:cron', 'deleteSystemTask').length === 1, 'Confirm must delete the selected task once')
  await click('Websites')

  await click('Manage projects')
  await click('Create from template')
  const laravel = () => [...document.querySelectorAll('.pqt-language-project-surface .truncate')]
    .find((item) => item.textContent.trim() === 'Laravel')
  await wait(laravel, 'Laravel template')
  laravel().click()
  const scaffoldDialog = () => document.querySelector('.el-dialog.new-project')
  await wait(() => scaffoldDialog()?.querySelector('.path-choose .icon-block'), 'Windows PHP scaffold dialog')
  scaffoldDialog().querySelector('.path-choose .icon-block').click()
  await wait(() => scaffoldDialog()?.querySelector('.path-choose input')?.value === 'C:/fixture/laravel', 'selected scaffold root')
  scaffoldDialog().querySelectorAll('.el-select')[2].click()
  const versionOption = () => [...document.querySelectorAll('.el-select-dropdown__item')]
    .find((element) => element.textContent.trim() === 'laravel latest')
  await wait(versionOption, 'Laravel version list')
  versionOption().click()
  await wait(() => button('OK', scaffoldDialog()) && !button('OK', scaffoldDialog()).disabled, 'scaffold confirmation')
  button('OK', scaffoldDialog()).click()
  await wait(() => scaffoldDialog() && button('Create Host', scaffoldDialog()), 'simulated PHP scaffold completion')
  assert(websiteTerminalCommands.length === 1 && websiteTerminalCommands[0].some((line) => line.includes('create-project --prefer-dist "laravel/laravel"')), 'PHP scaffold must request project creation with the chosen Laravel template: ' + JSON.stringify(websiteTerminalCommands))
  button('Create Host', scaffoldDialog()).click()
  await wait(() => modal()?.querySelector('h2')?.textContent === 'Create website', 'website draft from PHP scaffold')
  assert(field('Project root').value === 'C:/fixture/laravel/public', 'Laravel must prefill its public document root')
  await click('Routing')
  await wait(() => field('Nginx rewrite'), 'scaffold routing tab')
  assert(field('Nginx rewrite').value.includes('try_files $uri $uri/ /index.php$is_args$query_string;'), 'Laravel must prefill the generated Nginx rewrite')
  assert(requests('app-fork:host', 'handleHost').length === 0, 'Opening a scaffold draft must not write a host')
  await click('Close dialog')
  await click('＋ New website')
  await wait(() => field('Project root'), 'clean website draft')
  assert(field('Project root').value === '', 'A new website must not reuse a closed scaffold draft')
  await click('Close dialog')
  await click('Backup')
  await click('Export websites')
  await wait(() => modal()?.innerText.includes('Exported 3 websites.'), 'website export result')
  await click('Choose backup')
  await wait(() => modal()?.innerText.includes('restored.fixture.test') && modal()?.innerText.includes('Fixture preview warning'), 'import preview and warnings')
  assert(requests('app-fork:host', 'websiteBackupImport').length === 0, 'Preview must not commit the import')
  await click('Import 1 website')
  await wait(() => modal()?.innerText.includes('Writing fixture configuration…'), 'import progress')
  assert(button('Choose backup').disabled, 'The panel must block duplicate operations')
  await click('Close dialog')
  await click('Backup')
  assert(modal()?.innerText.includes('Writing fixture configuration…'), 'Import must survive closing and reopening its panel')
  finishWebsiteImport()
  await wait(() => modal()?.innerText.includes('Imported 1 website.'), 'committed import result')
  assert(requests('app-fork:host', 'websiteBackupImport').length === 1, 'Import must commit the reviewed snapshot once')
  await click('Close dialog')
  await select('restored.fixture.test')

  await select('alpha.fixture.test')
  await click('Site links')
  await wait(() => modal()?.innerText.includes('http://alias.fixture.test/'), 'alias endpoint')
  const aliasLink = [...modal().querySelectorAll('.site-link')]
    .find((link) => link.querySelector('code')?.textContent === 'http://alias.fixture.test/')
  button('Copy', aliasLink).click()
  await wait(() => requests('App-Node-FN', 'clipboard').some((entry) => entry[2] === 'writeText' && entry[3] === 'http://alias.fixture.test/'), 'alias copied')
  await click('Close dialog')
  await click('System hosts')
  await click('Copy generated entries')
  await wait(() => requests('App-Node-FN', 'clipboard').some((entry) => entry[3] === websiteFiles['C:/fixture/app.hosts.txt']), 'generated hosts copied')
  await click('Show generated file')
  await wait(() => requests('App-Node-FN', 'shell').some((entry) => entry[2] === 'showItemInFolder' && entry[3] === 'C:/fixture/app.hosts.txt'), 'revealed generated hosts')
  const syncs = requests('app-fork:host', 'writeHosts').length
  await click('Sync now')
  await wait(() => requests('app-fork:host', 'writeHosts').length === syncs + 1, 'automatic hosts sync')
  await click('Close dialog')
  await click('Add sites from subdirectories')
  await wait(() => modal()?.innerText.includes('alpha.fixture.test'), 'park confirmation')
  await click('Add subdirectory sites')
  await wait(() => document.querySelector('.project-list-panel')?.innerText.includes('blog.alpha.fixture.test') &&
    document.body.innerText.includes('Skipped another folder'), 'park added site and warning')
  assert(requests('app-fork:host', 'handleHost').length === 1, 'Park must send a single mutation')
})()`

try {
  await writeFile(fixturePath, `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="app"></div><script>${bootstrap}</script><script type="module">${mount}</script></body></html>`)
  await server.listen()
  const address = server.httpServer?.address()
  assert(address && typeof address !== 'string')
  const url = `http://127.0.0.1:${address.port}/render-next/${fixtureName}`
  const entry = join(temporary, 'main.cjs')
  await writeFile(entry, `
const { app, BrowserWindow } = require('electron')
app.setPath('userData', ${JSON.stringify(join(temporary, 'profile'))})
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1200, height: 850, webPreferences: { backgroundThrottling: false } })
  window.webContents.on('console-message', (event) => { if (event.level === 'error') console.error(event.message) })
  await window.loadURL(${JSON.stringify(url)})
  await window.webContents.executeJavaScript(${JSON.stringify(checks)})
  app.exit(0)
}).catch((error) => { console.error(error); app.exit(1) })
setTimeout(() => app.exit(2), 90000)
`)
  const env: NodeJS.ProcessEnv = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const outcome = await new Promise<{ code: number | null; output: string }>((done, reject) => {
    const child = spawn(String(electron), [entry], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (data) => { output += data.toString() })
    child.stderr.on('data', (data) => { output += data.toString() })
    child.once('error', reject)
    child.once('close', (code) => done({ code, output }))
  })
  assert.equal(outcome.code, 0, outcome.output)
  console.log('Windows Websites Electron UI passed for website management, local CA controls, scoped and system tasks, scaffold prefill, and backup.')
} finally {
  await server.close()
  await rm(fixturePath, { force: true })
  await rm(temporary, { recursive: true, force: true })
}
