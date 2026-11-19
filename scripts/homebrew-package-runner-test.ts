import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BrewPackageRunner } from '../src/fork/module/Brew/BrewPackageRunner'
import type { BrewFormulaSnapshot, BrewPackageAction } from '../src/fork/module/Brew/UpgradeTypes'
const previousDirectory = process.cwd()
const root = await mkdtemp(join(tmpdir(), 'brew runner '))
try {
  // Node can run the action argument as a script on every platform. Use the
  // script basename and remaining arguments to recover the original Brew argv.
  await Promise.all(
    ['upgrade', 'install', 'uninstall'].map((action) =>
      writeFile(join(root, action), "require('./fake-brew.cjs')\n")
    )
  )
  await writeFile(join(root, 'package.json'), '{"type":"commonjs"}')
  await writeFile(
    join(root, 'fake-brew.cjs'),
    `
const action = require('node:path').basename(process.argv[1])
const formula = process.argv.at(-1)
console.log(JSON.stringify([action, ...process.argv.slice(2)]))
console.log(process.env.HOMEBREW_NO_AUTO_UPDATE)
if (formula.includes('slow')) {
  process.on('SIGTERM', () => setTimeout(() => process.exit(3), 100))
  setInterval(() => console.log('working'), 20)
  setTimeout(() => process.exit(4), 5000).unref()
} else if (formula.includes('fail')) {
  console.error('failure')
  process.exitCode = 7
} else if (formula.includes('signal')) {
  process.kill(process.pid, 'SIGTERM')
} else if (formula.includes('large')) {
  console.log('x'.repeat(200000))
}
`
  )
  process.chdir(root)
  const runner = new BrewPackageRunner()
  const snapshot = (formula: string) =>
    ({
      identity: {
        bin: process.execPath,
        prefix: root,
        cellar: join(root, 'Cellar'),
        arch: 'arm64'
      },
      formula
    }) as BrewFormulaSnapshot
  const run = (
    action: BrewPackageAction,
    formula: string,
    operation: string,
    progress?: (data: string) => void
  ) => runner.runPackage(action, snapshot(formula), operation, progress)
  let chunks = 0
  const ok = await run('upgrade', 'homebrew/core/php', 'ok', () => {
    chunks++
  })
  assert.equal(ok.outcome, 'succeeded', [ok.error, ok.logs].filter(Boolean).join('\n'))
  assert.match(ok.logs, /\["upgrade","--formula","homebrew\/core\/php"\]/)
  assert.match(ok.logs, /^1$/m)
  assert(chunks > 0)
  assert.equal((await run('upgrade', 'homebrew/core/php-fail', 'fail')).code, 7)
  const signaled = await run('upgrade', 'homebrew/core/php-signal', 'signal')
  if (process.platform !== 'win32') {
    assert.equal(signaled.code, null)
    assert.equal(signaled.signal, 'SIGTERM')
  }
  assert.equal(signaled.outcome, 'failed')
  const large = await run('install', 'homebrew/core/php-large', 'large')
  assert(large.logs.length <= 65536)
  await assert.rejects(run('upgrade', 'php;touch /tmp/SHOULD_NOT_EXIST', 'bad'))
  let processReady!: () => void
  const ready = new Promise<void>((resolve) => {
    processReady = resolve
  })
  const slow = run('uninstall', 'homebrew/core/php-slow', 'slow', (text) => {
    if (text.includes('working')) processReady()
  })
  try {
    await Promise.race([
      ready,
      slow.then((result) => {
        assert.fail(result.error ?? result.logs)
      })
    ])
    assert.equal(runner.activeId, 'slow')
    await assert.rejects(run('upgrade', 'php', 'duplicate'), /busy/)
    const started = Date.now()
    runner.cancel('slow')
    assert.equal(runner.activeId, 'slow')
    const canceled = await slow
    assert.equal(canceled.outcome, 'failed')
    assert.equal(canceled.error, 'Homebrew command was terminated')
    if (process.platform !== 'win32') assert(Date.now() - started >= 90)
    assert.equal(runner.activeId, undefined)
  } finally {
    runner.cancel('slow')
    await slow
  }
  console.log(
    'PASS runner: real executable, exact argv, bounded streams, failure, injection rejection, cancel waits close, no duplicate'
  )
} finally {
  process.chdir(previousDirectory)
  await rm(root, { recursive: true, force: true })
}
