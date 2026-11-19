import assert from 'node:assert/strict'
import { loadIsolated } from './helpers/load-isolated'

const users = [{ id: 'test', email: 'test@example.test', roleSlug: 'global:member' }]
const calls: string[] = []
const notices: Array<[string, string]> = []
let completeWrite: ((result: { code: number; data?: object }) => void) | undefined
let failedList = false
let unknownWrite = false
let configured = '/fixture/original'
const { n8nUsersController: controller } = await loadIsolated(
  'src/render/components/N8N/UsersController.ts',
  {
    '@lang/index': { I18nT: (key: string) => key },
    'element-plus': { ElMessage: Object.fromEntries(
      ['error', 'warning', 'success'].map((kind) => [
        kind, (message: string) => notices.push([kind, message])
      ])
    ) },
    '@/util/Index': { reactiveBind: (value: unknown) => value },
    '@/util/NodeFn': { dialog: { showOpenDialog: async () => ({
      canceled: false, filePaths: ['/fixture/new']
    }) } },
    '@/util/ForkTerminalRequest': {
      forkTerminalRequest: async (
        channel: string,
        [action, ...args]: [string, ...unknown[]],
        timeout: string,
        _duration: number,
        _progress: undefined,
        sensitive: boolean
      ) => {
        assert.equal(channel, 'app-fork:n8n')
        assert.equal(sensitive, true)
        calls.push(action)
        if (action === 'getDataDir') return { code: 0, data: { path: configured } }
        if (action === 'userList') return failedList
          ? { code: 1, msg: 'Fixture list failure' }
          : { code: 0, data: users }
        if (action === 'setDataDir') {
          configured = String(args[0])
          return { code: 0 }
        }
        if (action === 'userResetPassword' && unknownWrite) throw new Error(timeout)
        assert.equal(action, 'userSetName')
        return new Promise((resolve) => { completeWrite = resolve })
      }
    }
  }
)

await controller.load()
assert.equal(controller.dataDir, '/fixture/original')
assert.deepEqual(controller.users, users)
assert.equal(controller.canManageUsers, true)
const mutation = controller.mutate('userSetName', ['test', 'Updated', 'Account'], 'Account changed')
assert.equal(controller.pending, 'userSetName')
assert.equal(await controller.mutate('userSetName', ['test', 'Duplicate', 'Account'], 'Changed'), false)
assert.equal(calls.filter((call) => call === 'userSetName').length, 1)
// Re-entering the panel while the write is active must not start a second load.
await controller.load()
assert.equal(calls.filter((call) => call === 'userList').length, 1)
failedList = true
completeWrite?.({ code: 0 })
assert.equal(await mutation, true)
assert.deepEqual(notices.slice(-2), [
  ['success', 'Account changed'],
  ['warning', 'Change saved. Could not refresh the n8n users. Fixture list failure']
])
assert.equal(controller.canManageUsers, false)

await controller.choose()
assert.equal(controller.dataDir, '/fixture/new')
assert.equal(controller.users.length, 0)
failedList = false
await controller.load()
unknownWrite = true
assert.equal(await controller.mutate('userResetPassword', ['test', 'fixture-password'], 'Changed'), false)
assert.equal(controller.unknown, true)
assert.equal(await controller.mutate('userResetPassword', ['test', 'fixture-password'], 'Changed'), false)
assert.equal(calls.filter((call) => call === 'userResetPassword').length, 1)
console.log('n8n user operations passed: sensitive IPC, duplicate guard, re-entry, partial refresh and unknown result.')
