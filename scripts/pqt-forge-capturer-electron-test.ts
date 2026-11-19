import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const evidence = resolve('.superpowers', 'capturer-electron')
await mkdir(evidence, { recursive: true })
const entry = join(evidence, 'entry.cjs')
await build({
  entryPoints: ['scripts/pqt-forge-capturer-electron-entry.ts'],
  outfile: entry,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  alias: { '@shared': resolve('src/shared'), '@lang': resolve('src/lang') },
  logLevel: 'silent'
})
const env: NodeJS.ProcessEnv = { ...process.env, PQT_CAPTURER_EVIDENCE: evidence }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(require('electron'), [entry], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
let output = ''
child.stdout.on('data', (data) => { output += data.toString() })
child.stderr.on('data', (data) => { output += data.toString() })
const timer = setTimeout(() => child.kill(), 60_000)
const code = await new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('exit', resolve) })
clearTimeout(timer)
await writeFile(join(evidence, 'electron.log'), output)
assert.equal(code, 0, output.slice(-12000))
const result = JSON.parse(await readFile(join(evidence, 'result.json'), 'utf8'))
assert.equal(result.success, true)
console.log('Actual Electron Capturer save integration passed; desktop API result: ' + JSON.stringify(result.desktop) + '; evidence: ' + evidence)
