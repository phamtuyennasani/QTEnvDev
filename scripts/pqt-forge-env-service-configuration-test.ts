import assert from 'node:assert/strict'
import {
  readEnvServiceFields,
  updateEnvServiceField
} from '../src/render-next/serviceConfiguration/envServiceDraft'
import { loadIsolated } from './helpers/load-isolated'
import {
  readMeilisearchFields,
  updateMeilisearchField
} from '../src/render-next/serviceConfiguration/meilisearchDraft'

const language = { '@lang/index': { I18nT: (name: string) => name } }
const { n8nCommonFields } = await loadIsolated(
  'src/render/components/N8N/commonFields.ts',
  language
)
const { mailpitCommonFields } = await loadIsolated(
  'src/render/components/MailPit/commonFields.ts',
  language
)
const n8n = n8nCommonFields()
const mailpit = mailpitCommonFields()
const field = (schema: ReturnType<typeof readEnvServiceFields>, name: string) => {
  const result = schema.find((item) => item.name === name)
  assert(result, `Missing configured field ${name}`)
  return result
}

const n8nDraft =
  '\uFEFF# keep the fallback\r\n# N8N_PORT=5678\r\n' +
  'N8N_USER_FOLDER="C:\\Data with spaces\\n8n"\r\n' +
  'N8N_HOST=fixture.test\r\nUNRELATED=a=b#c'
const n8nFields = readEnvServiceFields(n8nDraft, 'n8n', n8n)
const port = field(n8nFields, 'N8N_PORT')
const host = field(n8nFields, 'N8N_HOST')
const folder = field(n8nFields, 'N8N_USER_FOLDER')
assert.equal(port.enabled, false)
assert.equal(port.value, '5678')
assert.equal(folder.value, 'C:\\Data with spaces\\n8n')
assert.equal(
  updateEnvServiceField(n8nDraft, 'n8n', host, true, 'localhost'),
  n8nDraft.replace('N8N_HOST=fixture.test', 'N8N_HOST=localhost')
)
assert.equal(
  updateEnvServiceField(n8nDraft, 'n8n', folder, true, 'D:\\new folder'),
  n8nDraft.replace('C:\\Data with spaces\\n8n', 'D:\\new folder')
)
const enabled = updateEnvServiceField(n8nDraft, 'n8n', port, true, '4567')
assert.equal(enabled, n8nDraft + '\r\nN8N_PORT=4567\r\n')
assert.equal(updateEnvServiceField(enabled, 'n8n', port, false, '4567'), n8nDraft + '\r\n')
assert.equal(updateEnvServiceField(n8nDraft, 'n8n', port, true, '1\nEXTRA=true'), n8nDraft)

const duplicated = 'N8N_PORT=4567\nN8N_PORT=4568\nN8N_HOST=localhost\n'
const duplicates = readEnvServiceFields(duplicated, 'n8n', n8n)
assert.equal(field(duplicates, 'N8N_PORT').ambiguous, true)
assert.equal(field(duplicates, 'N8N_HOST').ambiguous, false)
assert.equal(updateEnvServiceField(duplicated, 'n8n', port, false, '4567'), duplicated)
assert.equal(updateEnvServiceField('N8N_PORT =5678', 'n8n', port, true, '4567'), 'N8N_PORT =5678')

const mailpitDraft =
  '# network settings\nMP_UI_BIND_ADDR=[::1]:8025\r\nMP_LABEL="a=b#c"\nMP_VERBOSE=false'
const mailpitFields = readEnvServiceFields(mailpitDraft, 'mailpit', mailpit)
const bind = field(mailpitFields, 'MP_UI_BIND_ADDR')
const verbose = field(mailpitFields, 'MP_VERBOSE')
const authFile = field(mailpitFields, 'MP_SMTP_AUTH_FILE')
assert.equal(bind.value, '[::1]:8025')
assert.equal(field(mailpitFields, 'MP_LABEL').value, '"a=b#c"')
assert.deepEqual(Array.from(verbose.options ?? [], (item) => item.value).sort(), ['false', 'true'])
assert.equal(authFile.isFile, true)
assert.equal(
  updateEnvServiceField(mailpitDraft, 'mailpit', authFile, true, 'C:\\Mail setup\\auth=file'),
  mailpitDraft + '\nMP_SMTP_AUTH_FILE=C:\\Mail setup\\auth=file\n'
)
assert.equal(
  updateEnvServiceField(mailpitDraft, 'mailpit', verbose, true, 'true'),
  mailpitDraft.replace('MP_VERBOSE=false', 'MP_VERBOSE=true')
)

const { minioCommonFields } = await loadIsolated(
  'src/render/components/Minio/commonFields.ts',
  language
)
const { rustfsCommonFields } = await loadIsolated(
  'src/render/components/Rustfs/commonFields.ts',
  language
)
const { meilisearchCommonFields } = await loadIsolated(
  'src/render/components/MeiliSearch/commonFields.ts',
  language
)

const minioDraft =
  '# defaults\r\nMINIO_ROOT_PASSWORD = "x=y#z"\r\nMINIO_ADDRESS="127.0.0.1:9000"\r\n'
const minio = readEnvServiceFields(minioDraft, 'minio', minioCommonFields())
assert.equal(field(minio, 'MINIO_ROOT_PASSWORD').value, 'x=y#z')
assert.equal(
  updateEnvServiceField(
    minioDraft,
    'minio',
    field(minio, 'MINIO_CERTS_DIR'),
    true,
    'C:\\cert files'
  ),
  minioDraft + 'MINIO_CERTS_DIR="C:\\cert files"\r\n'
)
const rustfsDraft = 'RUSTFS_ACCESS_KEY_FILE=C:\\keys\\access=key\r\nRUSTFS_SECRET_KEY=literal\r\n'
const rustfs = readEnvServiceFields(rustfsDraft, 'rustfs', rustfsCommonFields())
const accessFile = field(rustfs, 'RUSTFS_ACCESS_KEY_FILE')
assert.equal(accessFile.value, 'C:\\keys\\access=key')
assert.equal(
  updateEnvServiceField(rustfsDraft, 'rustfs', accessFile, true, 'C:\\keys and certs\\access=key'),
  rustfsDraft.replace('C:\\keys\\access=key', 'C:\\keys and certs\\access=key')
)

const tomlDraft =
  '\ufeff# meilisearch\r\nnotes = """\r\nhttp_addr = "127.0.0.1:7700"\r\n"""\r\n' +
  "db_path = 'C:\\dev#1\\meili' # use local data\r\n" +
  'http_addr = "127.0.0.1:7700" # default listen address\r\n' +
  'max_indexing_threads = 12\r\n[custom]\r\nhttp_addr = "local-only"\r\n'
const meiliSchema = meilisearchCommonFields()
const meili = readMeilisearchFields(tomlDraft, meiliSchema)
const dbPath = field(meili, 'db_path')
const http = field(meili, 'http_addr')
const maxThreads = field(meili, 'max_indexing_threads')
assert.equal(dbPath.value, 'C:\\dev#1\\meili')
assert.equal(http.value, '127.0.0.1:7700')
assert.equal(maxThreads.value, '12')
assert.equal(
  updateMeilisearchField(tomlDraft, dbPath, true, 'D:\\data # us'),
  tomlDraft.replace("'C:\\dev#1\\meili'", '"D:\\\\data # us"')
)
assert.equal(
  updateMeilisearchField(tomlDraft, http, true, 'localhost:8800'),
  tomlDraft.replace('"127.0.0.1:7700" #', '"localhost:8800" #')
)
assert.equal(
  updateMeilisearchField(tomlDraft, http, false, ''),
  tomlDraft.replace('http_addr = "127.0.0.1:7700" #', '#')
)
assert.equal(updateMeilisearchField(tomlDraft, maxThreads, true, '[]'), tomlDraft)
const scoped = '[custom]\r\nhttp_addr = "scoped"'
assert.equal(field(readMeilisearchFields(scoped, meiliSchema), 'http_addr').enabled, false)
assert.equal(
  updateMeilisearchField(scoped, http, true, 'localhost:8800'),
  'http_addr = "localhost:8800"\r\n' + scoped
)
const invalid = 'http_addr="a"\nhttp_addr="b"\n'
assert.equal(field(readMeilisearchFields(invalid, meiliSchema), 'http_addr').ambiguous, true)
assert.equal(updateMeilisearchField(invalid, http, true, 'localhost:8800'), invalid)

type PickerResult = { canceled: boolean; filePaths: string[] }
let pending: ((value: PickerResult) => void) | undefined
let pickerCalls = 0
const pickerWarnings: string[] = []
const { configurationPathPicker } = await loadIsolated(
  'src/render-next/serviceConfiguration/pathPickerController.ts',
  {
    '@/util/Index': { reactiveBind: (value: unknown) => value },
    '@/util/NodeFn': {
      dialog: {
        showOpenDialog: () =>
          new Promise<PickerResult>((resolve) => {
            pickerCalls++
            pending = resolve
          })
      }
    },
    '../state/app': { showNotice: (message: string) => pickerWarnings.push(message) }
  }
)
const paths: string[] = []
let current = true
const choosePath = () =>
  configurationPathPicker.choose(
    'db_path',
    true,
    '',
    () => current,
    (path: string) => paths.push(path)
  )
const old = choosePath()
await choosePath()
assert.equal(pickerCalls, 1)
current = false
pending?.({ canceled: false, filePaths: ['C:\\discarded'] })
await old
assert.deepEqual(paths, [])
assert.equal(configurationPathPicker.choosing, false)
current = true
const canceled = choosePath()
pending?.({ canceled: true, filePaths: [] })
await canceled
assert.deepEqual(paths, [])
const selected = choosePath()
pending?.({ canceled: false, filePaths: ['C:\\current'] })
await selected
assert.deepEqual(paths, ['C:\\current'])
assert.deepEqual(pickerWarnings, [])

console.log('Service settings preserve path syntax, TOML scope, line endings and picker lifetime.')
