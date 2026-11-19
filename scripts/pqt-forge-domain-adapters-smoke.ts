import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { reactive } from 'vue'
import { loadIsolated } from './helpers/load-isolated'

const checks: Array<[string, string[]]> = [
  ['src/render-next/adapters/projectAdapter.ts', ['AppStore', 'hostList', 'handleHost']],
  ['src/render-next/adapters/runtimeAdapter.ts', ['fetchInstalled', 'installed']],
  ['src/render-next/adapters/databaseAdapter.ts', ['fetchInstalled', 'installed']],
  ['src/render-next/websites/WebsiteController.ts', ['refresh()', 'this.deps.list()', 'this.deps.write']],
  ['src/render-next/state/databaseController.ts', ['result.installed', 'result.running']]
]
for (const [file, markers] of checks) {
  const source = readFileSync(file, 'utf8')
  for (const marker of markers) if (!source.includes(marker)) throw new Error(`${file} missing ${marker}`)
}

const configuredPython = { version: '3.12.9', path: '/fixtures/python312' }
const pathPython = { version: '3.13.2', path: '/fixtures/python313' }
const python = reactive({
  installed: [] as Array<typeof configuredPython>,
  async fetchInstalled() {
    this.installed = [configuredPython, pathPython]
    return true
  }
})
const serviceActions = {
  isInAppEnv: (item: typeof pathPython) => item.path === pathPython.path,
  async fetchPath() {}
}
const runtimeAdapter = await loadIsolated('src/render-next/adapters/runtimeAdapter.ts', {
  '@/store/app': { AppStore: () => ({ config: { server: { python: { current: configuredPython } } } }) },
  '@/store/brew': {
    BrewStore: () => ({
      modules: { python },
      module: () => python,
      currentVersion: () => configuredPython
    })
  },
  '@/components/ServiceManager/EXT/store': { ServiceActionStore: serviceActions }
})
const { runtimeController: runtime } = await loadIsolated(
  'src/render-next/state/runtimeController.ts',
  {
    '../adapters/runtimeAdapter': runtimeAdapter,
    '../moduleVisibility/visibility': { isBuiltinModuleVisible: (kind: string) => kind === 'python' },
    './projectWorkflowController': { isWorkflowKind: () => false },
    '@/components/ServiceManager/EXT/store': { ServiceActionStore: serviceActions }
  }
)
const runtimeEntry = () => runtime.visibleRuntimes.value[0]
assert.equal(runtimeEntry().state, 'available')
assert.equal(runtimeEntry().version, '—')
await runtime.refresh()
assert.equal(runtimeEntry().state, 'active')
assert.equal(runtimeEntry().version, pathPython.version)
assert.equal(runtimeEntry().path, pathPython.path)
python.installed = [configuredPython]
assert.equal(runtimeEntry().version, configuredPython.version)
python.installed = []
assert.equal(runtimeEntry().state, 'available')

console.log('PQT Forge domain adapter smoke check passed (projects, runtimes, and databases).')
