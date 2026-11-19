import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { loadIsolated } from './helpers/load-isolated'

if (process.platform !== 'win32') {
  console.log('Windows PowerShell PTY fixture skipped on this platform.')
  process.exit(0)
}

const { default: nodePty } = await loadIsolated('src/main/core/NodePTY.ts', {
  '../utils': { uuid: randomUUID },
  '@shared/EnvSync': {
    PowerShellPath: join(
      process.env.SystemRoot ?? 'C:\\Windows',
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe'
    ),
    sync: async () => ({ ...process.env })
  },
  '@shared/utils': { isWindows: () => true, isMacOS: () => false, isLinux: () => false }
})

try {
  for (const exitCode of [0, 23]) {
    const expectedKey = `native-exit-${exitCode}`
    const terminal = await nodePty.initNodePty()
    const result = Promise.withResolvers<{ code: number; data: { exitCode: number } }>()
    nodePty.onSendCommand(
      (_command: string, key: string, payload: { code: number; data: { exitCode: number } }) => {
        if (key === expectedKey) result.resolve(payload)
      }
    )
    const timeout = setTimeout(
      () => result.reject(new Error('PowerShell never reported a native process exit.')),
      15_000
    )
    try {
      await nodePty.exec(
        terminal,
        [`cmd.exe /d /c exit ${exitCode}`],
        'direct',
        'NodePty:exec',
        expectedKey,
        true
      )
      const reply = await result.promise
      assert.equal(reply.code, exitCode ? 1 : 0)
      assert.equal(reply.data.exitCode, exitCode)
      assert.equal(nodePty.pty[terminal], undefined)
    } finally {
      clearTimeout(timeout)
    }
  }
  console.log(
    'Windows PowerShell PTY preserved native exit codes 0 and 23 and removed both terminal handles.'
  )
} finally {
  nodePty.exitAllPty()
}
