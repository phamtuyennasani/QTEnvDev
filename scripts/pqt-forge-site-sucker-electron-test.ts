import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const evidence = resolve('.superpowers', 'site-sucker-electron')
await mkdir(evidence, { recursive: true })
const entry = join(evidence, 'entry.cjs')
await build({ entryPoints: ['scripts/pqt-forge-site-sucker-electron-entry.ts'], outfile: entry, bundle: true, platform: 'node', format: 'cjs', packages: 'external', alias: { '@shared': resolve('src/shared') }, logLevel: 'silent' })
const env: NodeJS.ProcessEnv = { ...process.env, PQT_MIRROR_EVIDENCE: evidence }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(require('electron'), [entry], { env, windowsHide: true, stdio: ['ignore','pipe','pipe'] })
let output = ''
child.stdout.on('data', (data) => { output += data.toString() })
child.stderr.on('data', (data) => { output += data.toString() })
const timer = setTimeout(() => child.kill(), 90000)
const code = await new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('exit', resolve) })
clearTimeout(timer)
await writeFile(join(evidence, 'electron.log'), output)
assert.equal(code, 0, output.slice(-10000))
assert.equal(JSON.parse(await readFile(join(evidence, 'result.json'), 'utf8')).success, true)
await rm(join(evidence, 'failure.txt'), { force: true })
console.log('Actual Electron Site Sucker integration passed; evidence: ' + evidence)
