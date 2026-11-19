import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'
import type { SoftInstalled } from '../src/shared/app'
import {
  resolvePgAdminPython,
  selectPgAdminPython
} from '../src/render/components/PostgreSql/PgAdminPython'
import { redisCommanderRequest } from '../src/render/components/Redis/RedisCommanderRequest'

const root = join(import.meta.dirname, '..')
const nextSource = (file: string) => readFileSync(join(root, 'src/render-next', file), 'utf8')
assert.match(nextSource('state/projectController.ts'), /reactiveBind\(new WebsiteController/)
assert.match(nextSource('websites/WebsiteController.ts'), /private mutation\?: Promise<boolean>/)
assert.match(nextSource('websites/WebsiteController.ts'), /WebsiteOutcomeUnknown/)
for (const file of [
  'screens/WebsitesScreen.vue', 'websites/WebsiteEditor.vue', 'websites/TomcatWebsiteEditor.vue',
  'websites/WebsiteFilesDialog.vue', 'components/ServiceFilesDialog.vue',
  'websites/NginxRewriteField.vue', 'components/LanguageProjectManager.vue',
  'screens/DatabasesScreen.vue', 'screens/ServicesScreen.vue', 'serviceDirectories/ServiceDirectory.vue',
  'screens/CronScreen.vue', 'components/HomebrewPackagePanel.vue',
  'screens/HttpServeScreen.vue', 'components/SdkmanPackagePanel.vue', 'components/MacPortsPackagePanel.vue',
  'custom-modules/CustomModulesSettings.vue', 'components/VhostTemplatePanel.vue'
]) {
  assert.doesNotMatch(nextSource(file), /IPC\.send|from ['"]@\/util\/IPC/)
}
assert.match(nextSource('components/HomebrewPackagePanel.vue'), /homebrewPackages as controller/)
assert.match(nextSource('components/HomebrewPackagePanel.vue'), /homebrewBootstrap as bootstrap/)
assert.match(nextSource('state/homebrewBootstrapController.ts'), /reactiveBind\(new HomebrewBootstrapController\(\)\)/)
assert.match(nextSource('components/MacPortsPackagePanel.vue'), /macportsPackages as controller/)
assert.match(nextSource('state/macportsPackagesController.ts'), /reactiveBind\(new MacPortsPackagesController\(\)\)/)
assert.match(nextSource('state/sdkmanPackagesController.ts'), /reactiveBind\(new SdkmanPackagesController\(\)\)/)
assert.match(nextSource('custom-modules/customModulesController.ts'), /reactiveBind\(new CustomModulesController\(\)\)/)
assert.match(nextSource('screens/CronScreen.vue'), /cronController as controller/)
assert.match(nextSource('state/cronController.ts'), /forkTerminalRequest\(/)
assert.match(nextSource('websites/TomcatWebsiteEditor.vue'), /projectController\.save\(/)
assert.match(nextSource('websites/WebsiteFilesDialog.vue'), /websiteFileController\.openExternal\(/)
assert.match(nextSource('state/serviceFilesController.ts'), /Project\.openPath\(/)
assert.match(nextSource('serviceDirectories/ServiceDirectory.vue'), /serviceDirectoryController as controller/)
assert.match(nextSource('serviceDirectories/controller.ts'), /reactiveBind\(new ServiceDirectoryController\(\)\)/)
assert.match(nextSource('components/VhostTemplatePanel.vue'), /vhostTemplateController as controller/)
assert.match(nextSource('websites/rewriteTemplatesController.ts'), /forkTerminalRequest\(/)
assert.match(nextSource('components/LanguageProjectManager.vue'), /projectWorkflowController\.openInEditor\(/)
assert.match(nextSource('screens/DatabasesScreen.vue'), /serviceController\.run/)
assert.match(nextSource('screens/DatabasesScreen.vue'), /database\?\.state === 'running'/)
assert.match(nextSource('state/databaseAdminController.ts'), /await dbGatePanel\.open\(\)/)
assert.match(nextSource('screens/DatabasesScreen.vue'), /redisConfiguration \? redisConfigurationFiles : undefined/)
assert.match(nextSource('redis/configuration.ts'), /forkTerminalRequest\(/)
assert.match(nextSource('redis/configuration.ts'), /unknownInitializations\.has\(file\.path\)/)
for (const file of ['components/RsaPanel.vue', 'components/MysqlCodePanel.vue']) assert.doesNotMatch(nextSource(file), /IPC\.send|rsaGenerateKeyPair/)
assert.match(nextSource('state/requestTimingController.ts'), /reactiveBind\(new RequestTimingOperation/)
assert.match(nextSource('state/rsaController.ts'), /reactiveBind\(new RsaOperation/)
assert.match(nextSource('state/mysqlCodeController.ts'), /reactiveBind\(new MysqlCodeOperation/)
const componentsDir = join(root, 'src', 'render', 'components')
const autoLaunchEntry = readFileSync(join(componentsDir, 'Setup/AutoLanch/index.vue'), 'utf8')
const autoLaunchController = readFileSync(join(componentsDir, 'Setup/AutoLanch/Controller.ts'), 'utf8')
assert.doesNotMatch(autoLaunchEntry, /IPC|setLoginItemSettings|saveConfig/)
assert.match(autoLaunchController, /reactiveBind\(new AutoLaunchController\(\)\)/)
const helperEntry = readFileSync(join(componentsDir, 'Setup/QTEnvDevHelper/index.vue'), 'utf8')
assert.doesNotMatch(helperEntry, /from ['"]@\/util\/IPC|forkTerminalRequest|onMounted/)
assert.match(helperEntry, /QTEnvDevHelperFix\.doFix\(showDialog\)/)
const agentsSource = readFileSync(join(root, 'AGENTS.md'), 'utf-8')
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
const walk = (dir: string): string[] => {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

const legacyDirectIpcIndexPages = [
  'Aside/Index.vue',
  'Tools/SiteSucker/Index.vue',
  'Tools/SystenEnv/Index.vue'
]

const actualDirectIpcIndexPages = walk(componentsDir)
  .filter((path) => basename(path) === 'Index.vue')
  .filter((path) => /from\s+['"]@\/util\/IPC['"]/.test(readFileSync(path, 'utf-8')))
  .map((path) => relative(componentsDir, path).split(sep).join('/'))
  .sort()

assert.deepEqual(actualDirectIpcIndexPages, legacyDirectIpcIndexPages)

const phpWindowsPage = readFileSync(join(componentsDir, 'PHP/Extension/Windows/index.vue'), 'utf-8')
const phpWindowsController = readFileSync(
  join(componentsDir, 'PHP/Extension/Windows/controller.ts'),
  'utf-8'
)
assert.doesNotMatch(phpWindowsPage, /from\s+['"]@\/util\/IPC['"]|IPC\.send/)
assert.match(phpWindowsPage, /windowsExtensions\.prepare\(/)
assert.match(phpWindowsPage, /windowsExtensions\.install\(/)
assert.match(phpWindowsPage, /windowsExtensions\.disable\(version,/)
assert.match(phpWindowsController, /reactiveBind\(\s*new WindowsExtensionController/)
assert.doesNotMatch(
  phpWindowsPage,
  /entry\.value\.(?:operation|log|result|error|installing)\s*=/,
  'closing operation details must not clear controller-owned work or results'
)

const loadedPhpSetup = readFileSync(join(componentsDir, 'PHP/Extension/Loaded/setup.ts'), 'utf-8')
const loadedPhpPage = readFileSync(join(componentsDir, 'PHP/Extension/Loaded/index.vue'), 'utf-8')
assert.match(loadedPhpSetup, /reactiveBind\(\s*new LoadedExtensionsController/)
assert.doesNotMatch(loadedPhpSetup, /exec\.exec|IPC\.send|LoadedSetup\.reFetch\s*=/)
assert.match(loadedPhpPage, /v-if="error"/)

const n8nAside = readFileSync(join(componentsDir, 'N8N/aside.vue'), 'utf8')
const n8nFork = readFileSync(join(root, 'src/fork/module/N8N/index.ts'), 'utf8')
assert.doesNotMatch(n8nAside, /IPC|checkRunning|onMounted|\bwatch\s*\(|\.run\s*=|\.pid\s*=/)
assert.doesNotMatch(n8nFork, /\bcheckRunning\s*\(/)
const n8nUsers = readFileSync(join(componentsDir, 'N8N/Users.vue'), 'utf8')
assert.doesNotMatch(n8nUsers, /IPC\.send|from ['"]@\/util\/IPC/)
assert.match(n8nUsers, /from ['"]\.\/UsersController/)

assert.match(agentsSource, /## Module Boundaries and Operation Ownership/)
assert.match(agentsSource, /UI state belongs to the mounted Vue component only/)
assert.match(
  agentsSource,
  /Existing shared domain state belongs to Pinia or the established module store/
)
assert.match(
  agentsSource,
  /Long-running renderer operations belong to a module-local singleton controller/
)
assert.match(
  agentsSource,
  /Fork modules own child processes, PID\/port state, and companion shutdown/
)
assert.match(agentsSource, /generic loading-state map cannot replace a controller/)
assert.match(agentsSource, /\.codex\/skills\/qtenvdev-module-boundaries\/SKILL\.md/)

assert.equal(
  packageJson.scripts?.['test:renderer-operation-boundaries'],
  'tsx scripts/renderer-operation-boundaries-test.ts'
)
assert.doesNotMatch(packageJson.scripts?.build ?? '', /test:renderer-operation-boundaries/)

const skillPath = join(root, '.codex', 'skills', 'qtenvdev-module-boundaries', 'SKILL.md')
assert.equal(existsSync(skillPath), true)
const skillSource = readFileSync(skillPath, 'utf-8')
assert.match(skillSource, /^---\nname: qtenvdev-module-boundaries\n/m)
assert.match(skillSource, /^description: Use when /m)
assert.match(skillSource, /AGENTS\.md/)
assert.match(skillSource, /view, domain, renderer operation, or fork process state/)
assert.match(skillSource, /module-local singleton controller/)
assert.match(
  skillSource,
  /duplicate invocation, progress retention, terminal cleanup, and page re-entry/
)
assert.doesNotMatch(skillSource, /TODO|TBD/)
assert.ok(skillSource.trim().split(/\s+/).length <= 600)

const skillMetadataPath = join(
  root,
  '.codex',
  'skills',
  'qtenvdev-module-boundaries',
  'agents',
  'openai.yaml'
)
assert.equal(existsSync(skillMetadataPath), true)

const controllers = [
  {
    page: 'ClickHouse/Index.vue',
    controller: 'ClickHouse/ChUiPanel.ts',
    instance: 'chUiPanel',
    className: 'ChUiPanel',
    stateName: 'opening',
    defaultExport: /export\s+default\s+new\s+[A-Za-z0-9_]+\(\)/
  },
  {
    page: 'MongoDB/Index.vue',
    controller: 'MongoDB/DbGatePanel.ts',
    instance: 'dbGatePanel',
    className: 'DbGatePanel',
    stateName: 'opening',
    defaultExport: /export\s+default\s+new\s+[A-Za-z0-9_]+\(\)/
  },
  {
    page: 'PostgreSql/Index.vue',
    controller: 'PostgreSql/PgAdminPanel.ts',
    instance: 'pgAdminPanel',
    className: 'PgAdminPanel',
    stateName: 'opening',
    defaultExport: /export\s+default\s+new\s+[A-Za-z0-9_]+\(\)/
  },
  {
    page: 'Redis/Index.vue',
    controller: 'Redis/RedisCommanderPanel.ts',
    instance: 'redisCommanderPanel',
    className: 'RedisCommanderPanel',
    stateName: 'opening',
    defaultExport: /export\s+default\s+new\s+[A-Za-z0-9_]+\(\)/
  },
  {
    page: 'Neo4j/Index.vue',
    controller: 'Neo4j/controller.ts',
    instance: 'neo4jController',
    className: 'Neo4jController',
    stateName: 'opening',
    defaultExport: /export\s+default\s+new\s+[A-Za-z0-9_]+\(\)/
  },
  {
    page: 'Host/Tomcat/Edit.vue',
    controller: 'Host/Tomcat/TomcatSiteController.ts',
    instance: 'tomcatSiteController',
    className: 'TomcatSiteController',
    stateName: 'saving',
    stateDeclaration: /saving = false/,
    defaultExport: /export\s+default\s+reactiveBind\(new\s+TomcatSiteController\(\)\)/
  }
]

for (const registration of controllers) {
  const pageSource = readFileSync(join(componentsDir, registration.page), 'utf-8')
  const controllerSource = readFileSync(join(componentsDir, registration.controller), 'utf-8')
  const controllerName = basename(registration.controller, '.ts')

  assert.match(
    pageSource,
    new RegExp(`import\\s+${registration.instance}\\s+from\\s+['"]\\./${controllerName}['"]`)
  )
  assert.doesNotMatch(pageSource, /from\s+['"]@\/util\/IPC['"]/)
  assert.match(controllerSource, new RegExp(`export\\s+class\\s+${registration.className}\\b`))
  assert.match(
    controllerSource,
    registration.stateDeclaration ??
      new RegExp(`readonly ${registration.stateName} = ref\\(false\\)`)
  )
  assert.doesNotMatch(controllerSource, /markRaw\(\s*new TomcatSiteSaveOperation/)
  assert.match(controllerSource, registration.defaultExport)
}

const pgAdminPanelSource = readFileSync(join(componentsDir, 'PostgreSql/PgAdminPanel.ts'), 'utf-8')
assert.match(pgAdminPanelSource, /resolvePgAdminPython\(/)
assert.doesNotMatch(pgAdminPanelSource, /currentVersion\('python'\)/)
assert.match(pgAdminPanelSource, /ServiceActionStore\.isInAppEnv\(candidate\)/)
assert.match(pgAdminPanelSource, /\(\) => ServiceActionStore\.fetchPath\(\)/)
assert.ok(
  pgAdminPanelSource.indexOf('this.opening.value = true') <
    pgAdminPanelSource.indexOf('await resolvePgAdminPython(')
)

const serviceActionStoreSource = readFileSync(
  join(componentsDir, 'ServiceManager/EXT/store.ts'),
  'utf-8'
)
assert.match(serviceActionStoreSource, /fetchPath: \(\) => Promise<void>/)
assert.match(serviceActionStoreSource, /const FETCH_PATH_TIMEOUT_MS = 20_000/)
assert.match(serviceActionStoreSource, /const FETCH_PATH_COOLDOWN_MS = 60_000/)
assert.match(serviceActionStoreSource, /setTimeout\(settle, FETCH_PATH_TIMEOUT_MS\)/)
assert.match(
  serviceActionStoreSource,
  /setTimeout\(\(\) => \{\s*ServiceActionStore\.fetchPathing = false\s*\}, FETCH_PATH_COOLDOWN_MS\)/
)
assert.match(serviceActionStoreSource, /ServiceActionStore\.fetchPathing = false/)

assert.doesNotMatch(nextSource('screens/RuntimesScreen.vue'), /IPC\.send|updatePath\(|fetchInstalled\(/)
assert.doesNotMatch(nextSource('serviceVersions/InstalledVersionsDialog.vue'), /IPC\.send|updatePath\(/)

for (const view of ['General', 'AndroidToolchain', 'CreateProject', 'EditProject']) {
  const source = readFileSync(join(componentsDir, `Flutter/${view}.vue`), 'utf8')
  assert.doesNotMatch(source, /IPC\.send|forkTerminalRequest\(/)
}

const versionDeleteDialog = readFileSync(
  join(componentsDir, 'ServiceManager/delDialog.vue'),
  'utf8'
)
const versionDeleteController = readFileSync(
  join(componentsDir, 'ServiceManager/VersionDeleteController.ts'),
  'utf8'
)
const versionDeleteOperation = readFileSync(
  join(componentsDir, 'ServiceManager/VersionDeleteOperation.ts'),
  'utf8'
)
assert.doesNotMatch(versionDeleteDialog, /fs\.remove|IPC\.send|MessageError|\.stop\(/)
assert.match(versionDeleteDialog, /v-if="managedDirectory"/)
assert.match(versionDeleteDialog, /confirmation\.value === FORCE_DELETE_CONFIRMATION/)
assert.match(versionDeleteDialog, /VersionDeleteController\.remove\(/)
assert.match(versionDeleteController, /reactiveBind\(/)
assert.match(versionDeleteController, /new VersionDeleteOperation\(/)
assert.match(versionDeleteController, /service\.stop\(\)/)
assert.match(versionDeleteOperation, /private operations = new Map/)
assert.match(versionDeleteOperation, /stopped !== true/)

const redisPage = readFileSync(join(componentsDir, 'Redis/Index.vue'), 'utf-8')
const redisPanel = readFileSync(join(componentsDir, 'Redis/RedisCommanderPanel.ts'), 'utf-8')
const pgAdminPythonCandidates = [
  { version: '3.14.3', bin: 'C:/QTEnvDev/python-3.14/python.exe', path: 'C:/QTEnvDev/python-3.14' },
  {
    version: '3.13.15',
    bin: 'C:/QTEnvDev/python-3.13/python.exe',
    path: 'C:/QTEnvDev/python-3.13'
  },
  { version: '3.9.13', bin: 'C:/QTEnvDev/python-3.9/python.exe', path: 'C:/QTEnvDev/python-3.9' }
]
assert.equal(
  selectPgAdminPython(pgAdminPythonCandidates, (candidate) => candidate.version === '3.13.15')
    ?.version,
  '3.13.15'
)
assert.equal(
  selectPgAdminPython(pgAdminPythonCandidates, (candidate) => candidate.version === '3.14.3')
    ?.version,
  '3.13.15'
)
assert.equal(
  selectPgAdminPython([pgAdminPythonCandidates[0]], () => false),
  undefined
)
assert.equal(
  selectPgAdminPython([pgAdminPythonCandidates[2], pgAdminPythonCandidates[1]], () => false)
    ?.version,
  '3.13.15'
)
const initiallyUnfetchedPythonModule: {
  installed: typeof pgAdminPythonCandidates
  fetchInstalled: (retryDataDirectory?: boolean) => Promise<boolean>
} = {
  installed: [],
  async fetchInstalled(retryDataDirectory) {
    assert.equal(retryDataDirectory, true)
    this.installed = [...pgAdminPythonCandidates]
    return true
  }
}
let pgAdminEnvPathsReady = false
assert.equal(
  (
    await resolvePgAdminPython(
      initiallyUnfetchedPythonModule,
      (candidate) => pgAdminEnvPathsReady && candidate.version === '3.9.13',
      async () => {
        pgAdminEnvPathsReady = true
      }
    )
  )?.version,
  '3.9.13'
)
const redisCommanderOpenRequest = redisCommanderRequest(
  { bin: '/tmp/node', rootPassword: 'node-secret' } as SoftInstalled,
  { version: '7.4.0', rootPassword: 'redis-secret' } as SoftInstalled
)
assert.deepEqual(redisCommanderOpenRequest, {
  node: { bin: '/tmp/node' },
  redis: { version: '7.4.0' }
})
assert.doesNotMatch(JSON.stringify(redisCommanderOpenRequest), /node-secret|redis-secret/)
assert.match(redisPage, /<template v-if="isRunning" #tool-left>/)
assert.match(redisPage, /:disabled="redisCommanderOpening"/)
assert.doesNotMatch(redisPage, /redisCommanderNodeAvailable/)
assert.match(redisPanel, /await brewStore\.module\('node'\)\.fetchInstalled\(true\)/)
assert.ok(
  redisPanel.indexOf('this.opening.value = true') <
    redisPanel.indexOf("await brewStore.module('node').fetchInstalled(true)")
)
assert.match(redisPanel, /IPC\.sendSensitive\('app-fork:redis', 'openRedisCommander'/)
assert.match(redisPanel, /redisCommanderRequest\(node, redis\)/)
assert.match(redisPanel, /isWebPanelInstallNotice/)
assert.match(redisPanel, /shell\.openExternal\(res\.data\.url\)/)
assert.doesNotMatch(redisPage, /from\s+['"]@\/util\/IPC['"]/)
assert.doesNotMatch(redisPage, /requirepass|RedisDir|readFile|redisCommanderConfig/)
assert.doesNotMatch(redisPanel, /requirepass|RedisDir|readFile|redisCommanderConfig/)

const languageProjectSource = readFileSync(
  join(componentsDir, 'LanguageProjects/Project.ts'),
  'utf-8'
)
const appNodeFnSource = readFileSync(join(root, 'src/main/core/AppNodeFn.ts'), 'utf-8')
const nodeFnSource = readFileSync(join(root, 'src/render/util/NodeFn.ts'), 'utf-8')
const shellInitControllerSource = readFileSync(
  join(componentsDir, 'Tools/ShellInitController.ts'),
  'utf-8'
)
assert.match(
  languageProjectSource,
  /import ShellInitController from '@\/components\/Tools\/ShellInitController'/
)
assert.doesNotMatch(languageProjectSource, /from\s+['"]@\/util\/IPC['"]/)
assert.match(languageProjectSource, /ShellInitController\.ensure\(\)/)
assert.match(languageProjectSource, /\[LanguageProjects\]\[setDirEnv\]\[timing\]/)
assert.match(languageProjectSource, /ensure-data-directory-ready/)
assert.match(languageProjectSource, /sync-roadrunner-config-port/)
assert.match(languageProjectSource, /write-project-env-file/)
assert.match(languageProjectSource, /save-project-directories/)
assert.match(languageProjectSource, /initialize-project-directories/)
assert.match(languageProjectSource, /initialize-shell-hook/)
assert.match(languageProjectSource, /import \{ debug, fs, shell \} from '@\/util\/NodeFn'/)
assert.match(languageProjectSource, /debug\s*\.log\(/)
assert.match(
  languageProjectSource,
  /logSetDirEnvTiming\(\{ event: 'step', \.\.\.context, step, durationMs \}\)/
)
assert.match(
  nodeFnSource,
  /export const debug = \{\s*log: createIPCCall<\[string, string\], void>\('debug', 'log'\)/
)
assert.match(
  appNodeFnSource,
  /debug_log\(command: string, key: string, flag: string, info: string\)/
)
assert.match(appNodeFnSource, /appDebugLog\(flag, info\)/)
assert.match(shellInitControllerSource, /export class ShellInitController\b/)
assert.match(
  shellInitControllerSource,
  /private inFlight\?: Promise<QTEnvDevShellInitResult \| undefined>/
)
assert.match(shellInitControllerSource, /response\?\.code === 200/)
assert.match(shellInitControllerSource, /IPC\.off\(key\)/)
assert.match(shellInitControllerSource, /response\.data\?\.warnings/)
assert.doesNotMatch(
  readFileSync(join(root, 'src/fork/module/Tool.win/GitBashIntegration.ts'), 'utf-8'),
  /readFileByRoot|Helper\.send|spawnPromise/,
  'normal Git Bash profiles must not trigger privileged operations'
)

const phpCreateControllerPath = join(
  componentsDir,
  'Host',
  'CreateProject',
  'PhpProjectCreateController.ts'
)
const phpCreateControllerSource = existsSync(phpCreateControllerPath)
  ? readFileSync(phpCreateControllerPath, 'utf-8')
  : ''
const phpCreateSource = readFileSync(
  join(componentsDir, 'Host', 'CreateProject', 'phpCreate.vue'),
  'utf-8'
)
const phpCreateWindowsSource = readFileSync(
  join(componentsDir, 'Host', 'CreateProject', 'phpCreate.win.vue'),
  'utf-8'
)
const projectSetupSource = readFileSync(
  join(componentsDir, 'Host', 'CreateProject', 'project.ts'),
  'utf-8'
)
const phpFormStart = projectSetupSource.indexOf('export type ProjectPHPForm')
const nodeFormStart = projectSetupSource.indexOf('export type ProjectNodeJSForm')
const phpFormSource = projectSetupSource.slice(phpFormStart, nodeFormStart)

assert.equal(existsSync(phpCreateControllerPath), true)
assert.match(phpCreateSource, /from ['"]\.\/PhpProjectCreateController['"]/)
assert.match(phpCreateWindowsSource, /from ['"]\.\/PhpProjectCreateController['"]/)
assert.doesNotMatch(phpCreateSource, /mv \.\/\* \.\.\//)
assert.doesNotMatch(phpCreateSource, /from ['"]@\/util\/XTerm['"]/)
assert.doesNotMatch(phpCreateWindowsSource, /from ['"]@\/util\/XTerm['"]/)
assert.doesNotMatch(phpCreateWindowsSource, /from ['"]@\/util\/IPC['"]/)
assert.doesNotMatch(phpCreateWindowsSource, /from ['"]@\/util\/Element['"]/)
assert.doesNotMatch(phpFormSource, /\brunning:/)
assert.doesNotMatch(phpFormSource, /\bcreated:/)
assert.doesNotMatch(phpFormSource, /\bcreateFail:/)
assert.doesNotMatch(projectSetupSource, /execing\.PHP/)
assert.match(phpCreateControllerSource, /export class PhpProjectCreateController\b/)
assert.match(phpCreateControllerSource, /import IPC from '@\/util\/IPC'/)
assert.match(phpCreateControllerSource, /import \{ reactiveBind \} from '@\/util\/Index'/)
assert.match(phpCreateControllerSource, /import \{ markRaw \} from 'vue'/)
assert.match(phpCreateControllerSource, /import XTerm from '@\/util\/XTerm'/)
assert.match(phpCreateControllerSource, /import \{ MessageError \} from '@\/util\/Element'/)
assert.match(phpCreateControllerSource, /markRaw\(new XTerm\(\)\)/)
assert.match(phpCreateControllerSource, /IPC\.send\('app-fork:project', 'handleProjectDir'/)
assert.match(phpCreateControllerSource, /response\?\.code === 200/)
assert.match(phpCreateControllerSource, /IPC\.off\(key\)/)
assert.match(
  phpCreateControllerSource,
  /export default reactiveBind\(new PhpProjectCreateController\(\)\)/
)
assert.ok(
  phpCreateControllerSource.indexOf('await terminal.send(commands, false)') <
    phpCreateControllerSource.indexOf("IPC.send('app-fork:project', 'handleProjectDir'")
)

// 权限页只能绑定控制器；IPC、进度、超时清理与版本保护必须由单例所有。
const privilegeDir = join(componentsDir, 'Setup', 'WindowsElevationMethod')
const privilegeController = readFileSync(join(privilegeDir, 'Controller.ts'), 'utf-8')
for (const filename of ['Choice.vue', 'index.vue']) {
  const page = readFileSync(join(privilegeDir, filename), 'utf-8')
  assert.doesNotMatch(page, /IPC\.send\(/)
}
assert.match(privilegeController, /reactiveBind\(new WindowsPrivilegeController\(\)\)/)
assert.match(privilegeController, /result\?\.code === 200/)
assert.match(privilegeController, /IPC\.off\(key\)/)
assert.match(privilegeController, /private operation\?: Promise<void>/)
assert.match(privilegeController, /snapshot\.revision < /)

// Include the LanguageProjects entry-page guards and its existing PID lifecycle contract.
await import('./language-project-ports-test')

console.log('renderer operation boundary tests passed')

// New toolbox owners must survive their initiating panel. Behavior fixtures exercise
// duplicate invocation, terminal events, stale callbacks and unknown-result recovery.
for (const name of ['CapturerPanel', 'SiteSuckerPanel', 'ImageCompressPanel']) {
  assert.doesNotMatch(readFileSync(join(root, 'src/render-next/components', name + '.vue'), 'utf8'), /IPC\.send/)
}
await import('./pqt-forge-capturer-test')
await import('./pqt-forge-site-sucker-test')
await import('./pqt-forge-image-pipeline-test')
await import('./pqt-forge-custom-modules-test')
await import('./pqt-forge-homebrew-mirrors-test')
await import('./pqt-forge-cron-controller-test')
assert.doesNotMatch(nextSource('components/SdkmanPackagePanel.vue'), /IPC\.send|new XTerm/)
await import('./pqt-forge-sdkman-test')
await import('./pqt-forge-git-environment-test')
await import('./pqt-forge-mysql-companion-test')
await import('./pqt-forge-postgresql-directory-test')
assert.match(
  readFileSync(join(root, 'src/render/components/Temporal/Index.vue'), 'utf8'),
  /import temporalUiController from '.\/UiController'/
)
assert.match(
  nextSource('serviceDashboards/controller.ts'),
  /return temporalUiController\.open\(showNotice\)/
)
await import('./pqt-forge-temporal-dashboard-test')
await import('./pqt-forge-database-details-test')
await import('./pqt-forge-service-files-test')
await import('./pqt-forge-n8n-users-test')
await import('./pqt-forge-web-server-settings-test')
assert.doesNotMatch(
  nextSource('serviceConfiguration/EnvServiceConfiguration.vue'),
  /showOpenDialog|IPC\.send/
)
await import('./pqt-forge-env-service-configuration-test')
const fileInfoPage = readFileSync(join(componentsDir, 'Tools/FileInfo/Index.vue'), 'utf8')
assert.match(fileInfoPage, /from ['"]\.\/Controller['"]/)
assert.doesNotMatch(fileInfoPage, /fs\.(?:stat|md5|sha1|sha256|sha512|sha384)\(/)
await import('./pqt-forge-file-info-test')

// Homebrew formula mutations are controller/fork owned; only bootstrap retains XTerm.
const homebrewPage = readFileSync(join(componentsDir, 'VersionManager/brew/index.vue'), 'utf8')
const homebrewSetup = readFileSync(join(componentsDir, 'VersionManager/brew/setup.ts'), 'utf8')
const homebrewItem = readFileSync(
  join(root, 'src/render/core/Module/ModuleHomebrewItem.ts'),
  'utf8'
)
const homebrewController = readFileSync(
  join(componentsDir, 'VersionManager/brew/Controller.ts'),
  'utf8'
)
assert.doesNotMatch(homebrewPage, /IPC\.send|new XTerm|Message(?:Error|Success|Warning)/)
assert.doesNotMatch(homebrewSetup + homebrewItem, /brew-cmd\.sh/)
assert.doesNotMatch(homebrewItem, /new XTerm|IPC\.send/)
assert.match(homebrewController, /reactiveBind\(\s*new HomebrewUpgradeController/)

const extensionBrewSetup = readFileSync(
  join(componentsDir, 'PHP/Extension/Homebrew/setup.ts'),
  'utf8'
)
const extensionBrewPage = readFileSync(
  join(componentsDir, 'PHP/Extension/Homebrew/index.vue'),
  'utf8'
)
assert.doesNotMatch(extensionBrewSetup + extensionBrewPage, /brew-cmd\.sh|new XTerm|xterm\?\.stop/)
assert.match(extensionBrewSetup, /homebrewUpgrade\s*\.package/)
assert.match(extensionBrewPage, /homebrewUpgrade\.busy/)

const dnsPage = readFileSync(join(root, 'src/render-next/screens/DnsServerScreen.vue'), 'utf8')
assert.match(dnsPage, /from ['"]\.\.\/dnsServer\/state['"]/)
assert.doesNotMatch(dnsPage, /IPC\.|forkTerminalRequest|fs\.writeFile/)
await import('./pqt-forge-dns-test')

const ftpPage = readFileSync(join(root, 'src/render-next/screens/FtpAccountsScreen.vue'), 'utf8')
assert.match(ftpPage, /from ['"]\.\.\/ftpAccounts\/state['"]/)
assert.doesNotMatch(ftpPage, /IPC\.|forkTerminalRequest|fs\.writeFile/)
await import('./pqt-forge-ftp-accounts-test')
