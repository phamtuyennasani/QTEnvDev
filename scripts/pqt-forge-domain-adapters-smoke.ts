import { readFileSync } from 'node:fs'

const checks: Array<[string, string[]]> = [
  ['src/render-next/adapters/projectAdapter.ts', ['AppStore', 'hostList', 'handleHost']],
  ['src/render-next/adapters/runtimeAdapter.ts', ['fetchInstalled', 'installed']],
  ['src/render-next/adapters/databaseAdapter.ts', ['fetchInstalled', 'installed']],
  ['src/render-next/websites/WebsiteController.ts', ['refresh()', 'this.deps.list()', 'this.deps.write']],
  ['src/render-next/state/runtimeController.ts', ['result.installed', "'available'"]],
  ['src/render-next/state/databaseController.ts', ['result.installed', 'result.running']]
]
for (const [file, markers] of checks) {
  const source = readFileSync(file, 'utf8')
  for (const marker of markers) if (!source.includes(marker)) throw new Error(`${file} missing ${marker}`)
}
console.log('PQT Forge domain adapter smoke check passed (projects, runtimes, and databases).')
