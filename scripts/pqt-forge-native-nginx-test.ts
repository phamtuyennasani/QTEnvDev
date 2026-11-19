import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { createServer as createTcpServer, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { promisify } from 'node:util'
import type { AppHost } from '../src/shared/app'
import { makeNginxConf, updateNginxConf } from '../src/fork/module/Nginx/Host'

const [, , nginxBin, opensslBin] = process.argv
assert.equal(process.platform, 'win32', 'This fixture exercises the Windows Nginx templates.')
assert(nginxBin && opensslBin, 'Provide nginx.exe and openssl.exe paths.')
await Promise.all([access(nginxBin), access(opensslBin)])

const temp = resolve(tmpdir())
const workspace = await mkdtemp(join(temp, 'pqt nginx sites-'))
const oldServer = global.Server
const run = promisify(execFile)
const loopback = '127.0.0.1'
const originalDomain = 'pqt-nginx-one.test'
const changedDomain = 'pqt-nginx-two.test'
const originalAlias = 'pqt-nginx-old-alias.test'
const changedAlias = 'pqt-nginx-new-alias.test'
const prefix = workspace.replaceAll('\\', '/') + '/'
const quote = (path: string) => JSON.stringify(path.replaceAll('\\', '/'))
const logs = join(workspace, 'logs')
const config = join(workspace, 'nginx.conf')
const errorLog = join(logs, 'error.log')
const launchOptions = { cwd: workspace, windowsHide: true }
const upstream = createServer((request, response) => {
  response.end(request.headers['x-forwarded-proto'] + ' upstream ' + request.url)
})
const reservations = Array.from({ length: 4 }, () => createTcpServer())

async function bind(server: Server) {
  server.listen({ host: loopback, port: 0, exclusive: true })
  await once(server, 'listening')
  const address = server.address()
  assert(address && typeof address !== 'string')
  return address.port
}

async function release(server: Server) {
  if (server.listening) await new Promise<void>((done) => server.close(() => done()))
}

function get(port: number, name: string, path: string, ca?: Buffer) {
  return new Promise<{ status?: number; body: string }>((resolve, reject) => {
    const request = (ca ? httpsRequest : httpRequest)(
      {
        hostname: loopback,
        port,
        path,
        headers: { Host: name },
        agent: false,
        ...(ca ? { ca, servername: name } : {})
      },
      (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          body += chunk
        })
        response.once('error', reject)
        response.once('end', () => resolve({ status: response.statusCode, body }))
      }
    )
    request.setTimeout(1000, () => request.destroy(new Error('Fixture request timed out')))
    request.once('error', reject)
    request.end()
  })
}

async function certificate(name: string, alias: string) {
  const cert = join(workspace, name + ' certificate.pem')
  const key = join(workspace, name + ' private key.pem')
  await run(
    opensslBin,
    [
      'req',
      '-config',
      join(workspace, 'openssl.cnf'),
      '-new',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-out',
      cert,
      '-keyout',
      key,
      '-subj',
      '/CN=' + name,
      '-addext',
      'subjectAltName=DNS:' + name + ',DNS:' + alias
    ],
    { ...launchOptions, timeout: 10_000 }
  )
  return { cert, key }
}

let stopServer: (() => Promise<void>) | undefined

async function launch(host: AppHost) {
  const vhost = join(workspace, 'vhost', 'nginx', host.id + '.conf')
  const generated = await readFile(vhost, 'utf8')
  const listeners = [...generated.matchAll(/^\s*listen (\d+)([^;\r\n]*);/gm)]
  assert.deepEqual(
    listeners.map((parts) => Number(parts[1])),
    [host.port.nginx, host.port.nginx_ssl]
  )
  // Bind only on loopback for the fixture. Keep every other generated directive.
  const loopbackVhost = generated.replace(
    /^(\s*listen )(\d+)([^;\r\n]*);/gm,
    (_match, directive: string, port: string, options: string) =>
      directive + loopback + ':' + port + options + ';'
  )
  await writeFile(
    config,
    [
      'master_process off;',
      'daemon off;',
      'error_log ' + quote(errorLog) + ';',
      'pid ' + quote(join(workspace, 'nginx.pid')) + ';',
      'events {}',
      'http {',
      'server_names_hash_max_size 4096;',
      'server_names_hash_bucket_size 512;',
      'server {',
      'listen ' + loopback + ':' + host.port.nginx + ' default_server;',
      'listen ' + loopback + ':' + host.port.nginx_ssl + ' ssl default_server;',
      'ssl_certificate ' + quote(host.ssl.cert) + ';',
      'ssl_certificate_key ' + quote(host.ssl.key) + ';',
      'return 421;',
      '}',
      loopbackVhost,
      '}'
    ].join('\n')
  )
  const args = ['-p', prefix, '-c', config]
  await run(nginxBin, [...args, '-t'], { ...launchOptions, timeout: 10_000 })
  const child = spawn(nginxBin, args, { ...launchOptions, stdio: ['ignore', 'pipe', 'pipe'] })
  let closed = false
  let output = ''
  const exit = new Promise<void>((done) =>
    child.once('close', () => {
      closed = true
      done()
    })
  )
  child.once('error', (error) => {
    output += String(error)
  })
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => {
      output = (output + chunk).slice(-8192)
    })
  }
  stopServer = async () => {
    if (!closed) child.kill()
    await exit
  }
  for (let attempt = 0; attempt < 100 && !closed; attempt++) {
    const ready = await get(host.port.nginx, host.name, '/index.html').then(
      ({ status }) => status === 200,
      () => false
    )
    if (ready) return
    await sleep(50)
  }
  throw new Error(
    'Nginx fixture could not serve its vhost.\n' +
      output +
      '\n' +
      (await readFile(errorLog, 'utf8').catch(() => ''))
  )
}

try {
  const [httpPort, httpsPort, editedHttpPort, editedHttpsPort] = await Promise.all(
    reservations.map(bind)
  )
  await Promise.all(reservations.map(release))
  const upstreamPort = await bind(upstream)
  await writeFile(join(workspace, 'openssl.cnf'), '[req]\ndistinguished_name = dn\n[dn]\n')
  const [originalCert, changedCert] = await Promise.all([
    certificate(originalDomain, originalAlias),
    certificate(changedDomain, changedAlias)
  ])
  const [originalCa, changedCa] = await Promise.all([
    readFile(originalCert.cert),
    readFile(changedCert.cert)
  ])
  const site = join(workspace, 'site root')
  const editedSite = join(workspace, 'edited site root')
  const staticDir = join(workspace, 'static')
  await Promise.all([
    mkdir(site),
    mkdir(editedSite),
    mkdir(logs),
    mkdir(staticDir),
    mkdir(join(workspace, 'temp'))
  ])
  const templates = join(staticDir, 'tmpl')
  await cp(resolve('static/tmpl/Windows'), templates, { recursive: true })
  for (const file of ['FrankenphpVhost', 'FrankenphpVhostSSL']) {
    await cp(resolve('static/tmpl', file), join(templates, file))
  }
  await Promise.all([
    writeFile(join(site, 'index.html'), 'fixture site'),
    writeFile(join(editedSite, 'index.html'), 'edited fixture site')
  ])
  global.Server = { BaseDir: workspace, Static: staticDir } as typeof global.Server
  const siteId = 976511
  const host: AppHost = {
    id: siteId,
    name: originalDomain,
    alias: originalAlias,
    root: site,
    useSSL: true,
    autoSSL: false,
    ssl: originalCert,
    port: {
      nginx: httpPort,
      nginx_ssl: httpsPort,
      apache: 80,
      apache_ssl: 443,
      caddy: 80,
      caddy_ssl: 443
    },
    envFile: '',
    url: '',
    nginx: { rewrite: 'rewrite ^/friendly$ /index.html last;' },
    reverseProxy: [{ path: '/api/', url: 'http://' + loopback + ':' + upstreamPort + '/' }]
  }
  await makeNginxConf(host)
  await launch(host)
  assert.deepEqual(await get(httpPort, originalAlias, '/friendly'), {
    status: 200,
    body: 'fixture site'
  })
  assert.deepEqual(await get(httpsPort, originalDomain, '/friendly', originalCa), {
    status: 200,
    body: 'fixture site'
  })
  assert.deepEqual(await get(httpPort, originalDomain, '/api/ping'), {
    status: 200,
    body: 'http upstream /ping'
  })
  assert.deepEqual(await get(httpsPort, originalDomain, '/api/ping', originalCa), {
    status: 200,
    body: 'https upstream /ping'
  })

  const updated: AppHost = {
    ...host,
    name: changedDomain,
    alias: changedAlias,
    root: editedSite,
    ssl: changedCert,
    port: { ...host.port, nginx: editedHttpPort, nginx_ssl: editedHttpsPort },
    nginx: { rewrite: 'rewrite ^/edited-friendly$ /index.html last;' },
    reverseProxy: [{ ...host.reverseProxy![0], path: '/new-api/' }]
  }
  await updateNginxConf(updated, host)
  const vhost = join(workspace, 'vhost', 'nginx', siteId + '.conf')
  const editedConfig = await readFile(vhost, 'utf8')
  await updateNginxConf(updated, updated)
  assert.equal(await readFile(vhost, 'utf8'), editedConfig)
  await stopServer?.()
  await launch(updated)
  assert.deepEqual(await get(editedHttpPort, changedAlias, '/edited-friendly'), {
    status: 200,
    body: 'edited fixture site'
  })
  assert.deepEqual(await get(editedHttpsPort, changedDomain, '/edited-friendly', changedCa), {
    status: 200,
    body: 'edited fixture site'
  })
  assert.deepEqual(await get(editedHttpPort, changedDomain, '/new-api/ping'), {
    status: 200,
    body: 'http upstream /ping'
  })
  assert.deepEqual(await get(editedHttpsPort, changedDomain, '/new-api/ping', changedCa), {
    status: 200,
    body: 'https upstream /ping'
  })
  assert.equal((await get(editedHttpPort, originalAlias, '/index.html')).status, 421)
  assert.equal((await get(editedHttpPort, changedDomain, '/friendly')).status, 404)
  assert.equal((await get(editedHttpsPort, changedDomain, '/api/ping', changedCa)).status, 404)
  assert.match(
    await readFile(join(workspace, 'vhost', 'logs', siteId + '.log'), 'utf8'),
    /GET \/new-api\/ping/
  )

  const withoutProxy = { ...updated, reverseProxy: [] }
  await updateNginxConf(withoutProxy, updated)
  await stopServer?.()
  await launch(withoutProxy)
  assert.equal((await get(editedHttpPort, changedDomain, '/new-api/ping')).status, 404)
  assert.equal((await get(editedHttpsPort, changedDomain, '/new-api/ping', changedCa)).status, 404)
  console.log(
    'Windows Nginx served generated HTTP, TLS, rewrites and proxy routes, then applied site, port, certificate and routing edits.'
  )
} finally {
  await stopServer?.()
  await Promise.all([upstream, ...reservations].map(release))
  global.Server = oldServer
  assert.equal(dirname(resolve(workspace)), temp)
  await rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}
