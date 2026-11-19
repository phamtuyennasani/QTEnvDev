import assert from 'node:assert/strict'
import {
  readEnvServiceFields,
  updateEnvServiceField
} from '../src/render-next/serviceConfiguration/envServiceDraft'
import { loadIsolated } from './helpers/load-isolated'

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
assert.deepEqual(
  Array.from(verbose.options ?? [], (item) => item.value).sort(),
  ['false', 'true']
)
assert.equal(authFile.isFile, true)
assert.equal(
  updateEnvServiceField(mailpitDraft, 'mailpit', authFile, true, 'C:\\Mail setup\\auth=file'),
  mailpitDraft + '\nMP_SMTP_AUTH_FILE=C:\\Mail setup\\auth=file\n'
)
assert.equal(
  updateEnvServiceField(mailpitDraft, 'mailpit', verbose, true, 'true'),
  mailpitDraft.replace('MP_VERBOSE=false', 'MP_VERBOSE=true')
)

console.log(
  'n8n and Mailpit field edits preserve scoped draft text, paths, quoting and line endings.'
)
