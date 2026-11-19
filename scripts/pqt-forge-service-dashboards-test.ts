import assert from 'node:assert/strict'
import { posix } from 'node:path'
import { dashboardPolicy, dashboardUrl } from '../src/render-next/serviceDashboards/endpoints'
import { loadIsolated } from './helpers/load-isolated'

const endpoints = await import('../src/render-next/serviceDashboards/endpoints')
const fixtures = [
  ['consul', '{"ports":{"http":48500}}', 'http://127.0.0.1:48500/ui/'],
  ['minio', 'MINIO_CONSOLE_ADDRESS="192.0.2.4:49001"', 'http://192.0.2.4:49001/'],
  ['rustfs', 'RUSTFS_CONSOLE_ADDRESS="[::]:49501"', 'http://127.0.0.1:49501/'],
  ['meilisearch', 'http_addr = "0.0.0.0:47700"', 'http://127.0.0.1:47700/'],
  ['mailpit', 'MP_UI_BIND_ADDR=:48025', 'http://127.0.0.1:48025/'],
  [
    'n8n',
    'N8N_PROTOCOL=https\nN8N_HOST=example.test\nN8N_PORT=45678\nN8N_PATH=workflow/',
    'https://example.test:45678/workflow/'
  ],
  ['rabbitmq', '', 'http://localhost:15672/'],
  ['qdrant', '', 'http://127.0.0.1:6333/dashboard'],
  ['zincsearch', 'ZINC_SERVER_ADDRESS=::\nZINC_SERVER_PORT=44080', 'http://127.0.0.1:44080/'],
  ['rnacos', 'RNACOS_HTTP_CONSOLE_PORT=40848', 'http://127.0.0.1:40848/rnacos/'],
  ['numa', 'api_port = 45380', 'http://127.0.0.1:45380/'],
  [
    'cliproxyapi',
    'port: 48317\napi-keys: [fixture-secret]',
    'http://127.0.0.1:48317/management.html'
  ],
  ['temporal-cli', 'ui-port = 48233', 'http://127.0.0.1:48233/']
]
for (const [flag, contents, url] of fixtures) {
  const policy = dashboardPolicy(flag)
  assert(policy)
  assert.equal(dashboardUrl(policy, contents), url, flag)
}
assert.equal(dashboardPolicy('Consul'), undefined)
assert.equal(dashboardPolicy('__proto__'), undefined)
const n8n = dashboardPolicy('n8n')!
for (const entry of [
  'N8N_PROTOCOL=file',
  'N8N_HOST=fixture-user:fixture-secret@example.test',
  'N8N_HOST=example.test/path',
  'N8N_PORT=65536',
  'N8N_PATH=//example.test/',
  'N8N_PATH=workflow?token=fixture-secret'
]) {
  assert.throws(() => dashboardUrl(n8n, entry), /Invalid dashboard/)
}

const first = { bin: '/fixtures/consul-1', version: '1.2.3', run: true }
const second = { bin: '/fixtures/consul-2', version: '2.0.0', run: false }
const moduleItem = { installed: [first, second] }
const opened: string[] = []
const reads: string[] = []
const notices: string[] = []
let read = async () => '{"ports":{"http":48500}}'
let completeShell: (result: { code: 0 | 1 }) => void
const temporalOpening = { value: true }
const { serviceDashboardController: controller, serviceDashboardLabel } = await loadIsolated(
  'src/render-next/serviceDashboards/controller.ts',
  {
    '@/store/brew': { BrewStore: () => ({ module: () => moduleItem }) },
    '@/components/Temporal/UiController': {
      opening: temporalOpening,
      openingLabel: 'Downloading Temporal UI (50%)',
      open: async (report: (text: string) => void) => {
        report('Temporal fixture notice')
        return false
      }
    },
    '@/util/path-browserify': posix,
    '@/util/NodeFn': {
      fs: {
        readFileStrict: async (path: string) => {
          reads.push(path)
          return read()
        }
      },
      shell: {
        openExternalChecked: (url: string) => {
          opened.push(url)
          return new Promise<{ code: 0 | 1 }>((resolve) => {
            completeShell = resolve
          })
        }
      }
    },
    '../state/app': { showNotice: (message: string) => notices.push(message) },
    './endpoints': endpoints
  },
  { window: { Server: { BaseDir: '/fixture' } } }
)
assert.equal(serviceDashboardLabel('temporal'), 'Open Temporal UI')
assert.equal(controller.isOpening('temporal'), true)
assert.equal(controller.openingLabel('temporal'), 'Downloading Temporal UI (50%)')
assert.equal(await controller.open('temporal'), false)
assert.equal(notices.pop(), 'Temporal fixture notice')
temporalOpening.value = false
assert.equal(controller.isOpening('temporal'), false)
let completeRead!: (data: string) => void
read = () =>
  new Promise<string>((resolve) => {
    completeRead = resolve
  })
const stale = controller.open('consul')
assert.equal(controller.isOpening('consul'), true)
assert.equal(await controller.open('consul'), false)
first.run = false
second.run = true
completeRead('{"ports":{"http":48500}}')
assert.equal(await stale, false)
assert.equal(reads[0], '/fixture/consul/consul-1.json')
assert.equal(opened.length, 0)

read = async () => {
  throw Object.assign(new Error('missing'), { code: 'ENOENT' })
}
const pending = controller.open('consul')
await new Promise<void>((resolve) => setImmediate(resolve))
assert.equal(reads[1], '/fixture/consul/consul-2.json')
assert.equal(controller.isOpening('consul'), true)
assert.deepEqual(opened, ['http://127.0.0.1:8500/ui/'])
completeShell!({ code: 0 })
assert.equal(await pending, true)
assert.equal(controller.isOpening('consul'), false)

const failedShell = controller.open('consul')
await new Promise<void>((resolve) => setImmediate(resolve))
completeShell!({ code: 1 })
assert.equal(await failedShell, false)
assert.equal(controller.isOpening('consul'), false)

read = async () => {
  throw new Error('fixture-secret')
}
assert.equal(await controller.open('consul'), false)
assert.equal(opened.length, 2)
assert.equal(controller.isOpening('consul'), false)
assert.equal(notices.join('').includes('fixture-secret'), false)
console.log(
  'Service dashboards passed: configured addresses, URL validation, version snapshots, duplicate admission and terminal shell.'
)
