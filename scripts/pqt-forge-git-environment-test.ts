import assert from 'node:assert/strict'
import { reactive } from 'vue'
import { loadIsolated } from './helpers/load-isolated'

class TerminalExitError extends Error {
  constructor(message: string, public exitCode?: number) { super(message) }
}

const terminals: FakeTerminal[] = []
const finishTurn = () => new Promise<void>((resolve) => setImmediate(resolve))
class FakeTerminal {
  ptyKey = ''
  dom?: object
  request?: unknown[]
  outcome = Promise.withResolvers<boolean>()
  stopped = 0
  released = 0
  destroyed = false
  constructor() { terminals.push(this) }
  async initialize() { this.ptyKey = 'fixture' }
  async mount(element: object) { this.dom = element }
  unmounted() { this.dom = undefined }
  destroy() { this.destroyed = true; this.unmounted() }
  releaseProcessOutput() { this.released++ }
  send(...args: unknown[]) { this.request = args; return this.outcome.promise }
  async stop() { this.stopped++; this.outcome.resolve(true) }
}

const server = { isWindows: true, isMacOS: false, isLinux: false, BrewCellar: '', MacPorts: '' }
let installed = false
let detectFails = false
let diagnosticFails = false
let checks = 0
const { gitEnvironment: controller } = await loadIsolated(
  'src/render-next/state/gitEnvironmentController.ts',
  {
    '@/util/IPC': {},
    '@/util/Index': { reactiveBind: reactive },
    '@/util/XTerm': Object.assign(FakeTerminal, { TerminalExitError }),
    '../packages/types': { packageError: (error: Error) => error.message },
    '../packages/transport': {
      async packageRequest(_ipc: unknown, service: string, [command]: string[]) {
        assert.equal(service, 'app-fork:git')
        if (command === 'checkInstalled') {
          checks++
          if (detectFails) throw new Error('Git detection unavailable')
          return { installed, version: 'git version 2.54.0' }
        }
        assert.equal(command, 'check')
        if (diagnosticFails) throw new Error('SSH diagnostics unavailable')
        return { items: [{ label: 'Git version', ok: true, value: 'git --version', message: '2.54.0' }] }
      }
    }
  },
  { window: { Server: server, QTEnvDevNodeAPI: {} } }
)

assert.equal(controller.start('winget'), undefined)
await controller.refresh()
assert.equal(controller.start('port'), undefined)
const failed = controller.start('winget')
assert.equal(controller.start('winget'), failed)
await finishTurn()
const terminal = terminals[0]
assert.deepEqual(JSON.parse(JSON.stringify(terminal.request)), [[
  'winget.exe install --id Git.Git --exact --source winget --accept-source-agreements --accept-package-agreements'
], 'direct', true])
const firstView = {}
const nextView = {}
await controller.attach(firstView)
controller.detach(firstView)
await controller.attach(nextView)
controller.detach(firstView)
assert.equal(terminal.dom, nextView)
assert.equal(controller.phase, 'running')
terminal.outcome.reject(new TerminalExitError('Installer rejected the request', 23))
await failed
assert.equal(controller.phase, 'failed')
assert.equal(terminal.stopped, 0)
assert.equal(terminal.released, 1)

const cancelled = controller.start('winget')
await controller.cancel()
await cancelled
assert.equal(controller.phase, 'cancelled')
assert.equal(terminals[1].request, undefined)
assert.equal(terminals[1].stopped, 1)
assert.equal(terminal.destroyed, true)

const completed = controller.start('winget')
await finishTurn()
detectFails = true
terminals[2].outcome.resolve(true)
await completed
assert.equal(controller.phase, 'succeeded')
assert.match(controller.discoveryError, /unavailable/)
assert.equal(controller.start('winget'), undefined)
assert.equal(checks, 4)

detectFails = false
installed = true
diagnosticFails = true
await controller.refresh()
assert.equal(controller.installed, true)
assert.equal(controller.version, 'git version 2.54.0')
assert.match(controller.discoveryError, /SSH diagnostics/)
diagnosticFails = false
await controller.refresh()
assert.equal(controller.phase, 'succeeded')
assert.equal(controller.items.length, 1)

// The Apple installer only opens the separate system dialog. It does not wait for Git.
Object.assign(server, { isWindows: false, isMacOS: true, BrewCellar: '/opt/homebrew/Cellar', MacPorts: '/opt/local/bin/port' })
assert.deepEqual(Array.from(controller.methods, ({id}: { id: string }) => id), ['xcode', 'brew', 'port'])
Object.assign(server, { isMacOS: false, isLinux: true })
assert.deepEqual(Array.from(controller.methods, ({id}: { id: string }) => id), ['system', 'brew'])

console.log('Git environment passed: detection, valid providers, detached terminal, process failure, cancellation and successful installation with failed discovery.')
