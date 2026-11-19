import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { createServer } from 'node:http'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { MirrorOperation, type MirrorEvent } from '../src/main/ui/SiteSucker/Operation'
import { MirrorBrowserAdapter } from '../src/main/ui/SiteSucker/BrowserAdapter'

const evidence = process.env.PQT_MIRROR_EVIDENCE!
app.setPath('userData', join(evidence, 'electron-user-data'))
app.commandLine.appendSwitch('no-first-run')
app.commandLine.appendSwitch('disable-gpu')
app.on('window-all-closed', () => {})
const hits: Record<string, number> = {}
const sockets = new Set<any>()
const server = createServer((req, res) => {
  const path = req.url || '/'
  hits[path] = (hits[path] || 0) + 1
  if (path === '/') { res.setHeader('content-type', 'text/html'); res.end('<html><head><link rel="stylesheet" href="/app.css"></head><body><a href="/second">Second</a><a href="/third">Third</a><img src="/image.png"><img srcset="/image.png 1x"><p style="background:url(/image.png)">Hello</p></body></html>'); return }
  if (path === '/second') { res.setHeader('content-type', 'text/html'); res.end('<html><body>Second page</body></html>'); return }
  if (path === '/third') { res.setHeader('content-type', 'text/html'); res.end('<html><body>Third page</body></html>'); return }
  if (path === '/app.css') { res.setHeader('content-type', 'text/css'); res.end('body{background:url(/image.png)}'); return }
  if (path === '/image.png') { res.setHeader('content-type', 'image/png'); res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64')); return }
  if (path === '/retry') { if (hits[path] === 1) { res.destroy(); return }; res.setHeader('content-type', 'text/html'); res.end('<p>Retried</p>'); return }
  if (path === '/slow') { res.setHeader('content-type', 'text/html'); res.write('<p>Loading'); const timer = setInterval(() => res.write('still waiting'), 50); res.on('close', () => clearInterval(timer)); return }
  if (path === '/large-page') { res.setHeader('content-type', 'text/html'); res.end(Buffer.alloc(2 * 1024 * 1024, 65)); return }
  if (path === '/large') { res.setHeader('content-type', 'text/html'); res.end('<img src="/large.png">'); return }
  if (path === '/large.png') { res.setHeader('content-type', 'image/png'); let count = 0; const timer = setInterval(() => { if (count++ > 30) { clearInterval(timer); res.end(); return }; res.write(Buffer.alloc(65536)) }, 2); res.on('close', () => clearInterval(timer)); return }
  res.statusCode = 404; res.end('not found')
})
server.on('connection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })

async function main() {
  await mkdir(evidence, { recursive: true })
  await app.whenReady()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const base = 'http://127.0.0.1:' + address.port
  const results: Record<string, unknown> = {}
  const events: MirrorEvent[] = []
  const run = async (id: string, path: string, config: Record<string, unknown> = {}) => {
    const adapter = new MirrorBrowserAdapter(id, () => {})
    const operation = new MirrorOperation(id, base + path, { dir: join(evidence, id), maxRetryTimes: 2, windowCount: 2, timeout: 5000, ...config }, adapter, (event) => events.push(event))
    const result = await operation.run()
    assert.equal(BrowserWindow.getAllWindows().length, 0, 'Every native browser worker must close')
    results[id] = result
    await writeFile(join(evidence, id + '-result.json'), JSON.stringify(result, null, 2))
    await writeFile(join(evidence, 'hits.json'), JSON.stringify(hits, null, 2))
    return result
  }
  const success = await run('success', '/')
  assert.equal(success.state, 'completed')
  assert.equal(success.links.filter((link) => link.state === 'success').length, 5)
  const root = join(evidence, 'success', '127.0.0.1_' + address.port)
  assert.match(await readFile(join(root, 'index.html'), 'utf8'), /assets\//)
  const css = success.links.find((link) => link.type?.includes('text/css'))!
  assert.match(await readFile(join(root, css.file!), 'utf8'), /url\([a-f0-9]+\.png\)/)
  const retry = await run('retry', '/retry')
  assert.equal(retry.state, 'completed'); assert.ok(hits['/retry'] >= 2)
  let operation!: MirrorOperation
  const adapter = new MirrorBrowserAdapter('cancel', () => {})
  operation = new MirrorOperation('cancel', base + '/slow', { dir: join(evidence, 'cancel'), timeout: 5000 }, adapter, (event) => { events.push(event); if (event.kind === 'link' && event.link.state === 'running') setTimeout(() => { void operation.cancel() }, 200) })
  const cancelled = await operation.run(); results.cancel = cancelled
  assert.equal(cancelled.state, 'cancelled'); assert.equal(BrowserWindow.getAllWindows().length, 0)
  const bounded = await run('bounded', '/large', { maxImgSize: 1, maxFileSize: 1, maxTotalSize: 5 })
  assert.equal(bounded.state, 'partial'); assert.ok(bounded.links.some((link) => link.state === 'fail' && /exceeds/.test(link.reason || '')))
  const pageLimit = await run('page-bound', '/large-page', { maxFileSize: 1 })
  assert.equal(pageLimit.state, 'partial')
  let closedOperation!: MirrorOperation
  const closedAdapter = new MirrorBrowserAdapter('window-close', () => { void closedOperation.cancel() })
  closedOperation = new MirrorOperation('window-close', base + '/slow', { dir: join(evidence, 'window-close'), timeout: 5000 }, closedAdapter, () => {})
  const closedRun = closedOperation.run()
  setTimeout(() => { BrowserWindow.getAllWindows()[0]?.close() }, 200)
  const closedResult = await closedRun; results.windowClose = closedResult
  assert.equal(closedResult.state, 'cancelled'); assert.equal(BrowserWindow.getAllWindows().length, 0)
  const allNames = async (path: string): Promise<string[]> => { const entries = await readdir(path, { withFileTypes: true }); return (await Promise.all(entries.map((entry) => entry.isDirectory() ? allNames(join(path, entry.name)) : [entry.name]))).flat() }
  assert.equal((await allNames(evidence)).some((name) => name.includes('.part-')), false, 'No partial output may remain')
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ success: true, results, hits, events }, null, 2))
}
main().then(() => { console.log('SITE_SUCKER_ELECTRON_PASS'); app.exit(0) }).catch(async (error) => { console.error(error); await mkdir(evidence, { recursive: true }); await writeFile(join(evidence, 'failure.txt'), String(error?.stack || error)); app.exit(1) }).finally(() => { for (const socket of sockets) socket.destroy(); server.close() })
