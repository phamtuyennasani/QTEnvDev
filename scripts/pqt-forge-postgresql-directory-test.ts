import assert from 'node:assert/strict'
import { posix } from 'node:path'
import { loadIsolated } from './helpers/load-isolated'

const initial: Record<string, string> = { '/fixture/pg17/bin/postgres': '/fixture/saved-data' }
let failWrite = false
let writes = 0
let saved: Record<string, string> = { ...initial }
const { PostgreSqlSetup } = await loadIsolated('src/render/components/PostgreSql/setup.ts', {
  vue: { reactive: (value: unknown) => value },
  localforage: {
    getItem: async () => ({ ...saved }),
    async setItem(_key: string, value: Record<string, string>) {
      writes++
      if (failWrite) throw new Error('Fixture write failed')
      saved = { ...value }
    }
  }
})

const globals = { window: { Server: { DataDirectoryReady: true, PostgreSqlDir: '/fixture' } } }
const version = { version: '17.4', bin: '/fixture/pg17/bin/postgres', run: false, running: false }
const module = { installed: [version], starting: false }
const brew = { BrewStore: () => ({ module: () => module, currentVersion: () => version }) }
const lifecycle = await loadIsolated(
  'src/render/components/PostgreSql/lifecycle.ts',
  { '@/store/brew': brew, '@/util/path-browserify': posix, './setup': { PostgreSqlSetup } },
  globals
)
let completePicker: (value: { canceled: boolean; filePaths: string[] }) => void
let pickers = 0
const { postgreSqlDataDirectoryController: controller } = await loadIsolated(
  'src/render/components/PostgreSql/dataDirectoryController.ts',
  {
    '@/store/brew': brew,
    '@/util/Index': { reactiveBind: (value: unknown) => value },
    '@/util/NodeFn': {
      dialog: {
        showOpenDialog: () => {
          pickers++
          return new Promise((resolve) => {
            completePicker = resolve
          })
        }
      },
      shell: {}
    },
    './setup': { PostgreSqlSetup },
    './lifecycle': lifecycle
  },
  globals
)

await controller.load()
assert.equal(controller.path, initial[version.bin])
const canceled = controller.choose()
await controller.choose()
assert.equal(pickers, 1)
completePicker!({ canceled: true, filePaths: [] })
await canceled
assert.equal(writes, 0)
assert.equal(controller.busy, false)

const blocked = controller.choose()
version.run = true
completePicker!({ canceled: false, filePaths: ['/fixture/blocked'] })
await blocked
assert.equal(writes, 0)
assert.match(controller.error, /service state changed/)
version.run = false

failWrite = true
const failed = controller.choose()
completePicker!({ canceled: false, filePaths: ['/fixture/failed'] })
await failed
assert.equal(controller.path, initial[version.bin])
assert.match(controller.error, /Fixture write failed/)
assert.equal(await lifecycle.postgreSqlDataDirectory(version), initial[version.bin])

failWrite = false
const retried = controller.choose()
completePicker!({ canceled: false, filePaths: ['/fixture/updated'] })
await retried
assert.equal(controller.path, '/fixture/updated')
assert.equal(saved[version.bin], '/fixture/updated')
assert.equal(await lifecycle.postgreSqlDataDirectory(version), '/fixture/updated')
console.log(
  'PostgreSQL directory picker preserves saved data through cancellation, failures and retry.'
)
