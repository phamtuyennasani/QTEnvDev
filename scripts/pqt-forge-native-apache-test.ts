import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { createServer as createTcpServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { promisify } from 'node:util'
import type { AppHost } from '../src/shared/app'
import { loadIsolated } from './helpers/load-isolated'

const [, , apacheBin, phpCgiBin, opensslBin] = process.argv
assert(process.platform === 'win32', 'This fixture exercises the Windows vhost templates.')
assert(
  apacheBin && phpCgiBin && opensslBin,
  'Provide httpd.exe, php-cgi.exe and openssl.exe paths.'
)
assert([apacheBin, phpCgiBin, opensslBin].every(isAbsolute), 'Provide absolute executable paths.')
await Promise.all([apacheBin, phpCgiBin, opensslBin].map((bin) => access(bin)))

const run = promisify(execFile)
const loopback = '127.0.0.1'
const unixPath = (value: string) => value.replace(/\\/g, '/')
const quote = (value: string) => JSON.stringify(unixPath(value))
const root = await mkdtemp(join(tmpdir(), 'pqt-apache-sites-'))
const originalDomain = 'pqt-apache-one.test'
const newDomain = 'pqt-apache-two.test'
const alias = 'pqt-apache-alias.test'
const upstream = createServer((req, res) => res.end('fixture upstream: ' + req.url))
const children: Array<{ stop: () => Promise<void> }> = []

async function bind(server: ReturnType<typeof createTcpServer>, port = 0) {
  server.listen({ host: loopback, port, exclusive: true })
  await once(server, 'listening')
  const address = server.address()
  assert(address && typeof address !== 'string')
  return address.port
}

async function release(server: ReturnType<typeof createTcpServer>) {
  await new Promise<void>((done) => server.close(() => done()))
}

async function phpPort() {
  // Windows vhosts derive their FastCGI port by prefixing the PHP version with 90.
  for (let port = 9099; port > 9009; port--) {
    const socket = createTcpServer()
    try {
      await bind(socket, port)
      await release(socket)
      return port
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error
    }
  }
  throw new Error('No free loopback port for the isolated FastCGI worker.')
}

function start(bin: string, args: string[]) {
  const process = spawn(bin, args, {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let logs = ''
  let closed = false
  const exit = new Promise<void>((done) => {
    process.once('close', () => {
      closed = true
      done()
    })
  })
  process.once('error', (error) => {
    logs += String(error)
  })
  for (const stream of [process.stdout, process.stderr]) {
    stream.on('data', (chunk) => {
      logs = (logs + chunk).slice(-8192)
    })
  }
  const fixture = {
    get logs() {
      return logs
    },
    get closed() {
      return closed
    },
    async stop() {
      if (!closed) process.kill()
      await exit
    }
  }
  children.push(fixture)
  return fixture
}

function get(port: number, domain: string, path: string, ca?: Buffer) {
  return new Promise<{ status: number | undefined; body: string }>((done, fail) => {
    const request = (ca ? httpsRequest : httpRequest)(
      {
        hostname: loopback,
        port,
        path,
        headers: { Host: domain },
        agent: false,
        ...(ca ? { servername: domain, ca } : {})
      },
      (res) => {
        res.setEncoding('utf8')
        let body = ''
        res.on('data', (part) => {
          body += part
        })
        res.once('end', () => done({ status: res.statusCode, body }))
        res.once('error', fail)
      }
    )
    request.setTimeout(1000, () => request.destroy(new Error('HTTP request timed out')))
    request.once('error', fail)
    request.end()
  })
}

try {
  const reserved = [createTcpServer(), createTcpServer(), createTcpServer()]
  const [httpPort, httpsPort, changedPort] = await Promise.all(
    reserved.map((server) => bind(server))
  )
  await Promise.all(reserved.map(release))
  const upstreamPort = await bind(upstream)
  const fastCgiPort = await phpPort()
  const cert = join(root, 'cert.pem')
  const key = join(root, 'key.pem')
  const opensslConfig = join(root, 'openssl.cnf')
  const site = join(root, 'site root')
  const apacheConfig = join(root, 'httpd.conf')
  const fixtureLog = join(root, 'httpd-error.log')

  await writeFile(opensslConfig, '[req]\ndistinguished_name = dn\n[dn]\n')
  await run(
    opensslBin,
    [
      'req',
      '-config',
      opensslConfig,
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
      '/CN=' + originalDomain,
      '-addext',
      'subjectAltName=DNS:' + [originalDomain, newDomain, alias].join(',DNS:')
    ],
    { cwd: root, windowsHide: true, timeout: 10000 }
  )
  const ca = await readFile(cert)
  await mkdir(site)
  await Promise.all([
    writeFile(join(site, 'index.html'), 'fixture website'),
    writeFile(join(site, 'runtime.php'), '<?php echo "fixture PHP ".PHP_VERSION;'),
    writeFile(
      join(site, '.htaccess'),
      'RewriteEngine On\nRewriteRule ^friendly$ index.html [END]\n'
    )
  ])

  const templates = resolve('static/tmpl/Windows')
  const vhostName = await loadIsolated('src/fork/module/Host/vhostName.ts', {})
  const { makeApacheConf, updateApacheConf } = await loadIsolated(
    'src/fork/module/Apache/Host.ts',
    {
      '../../Fn': {
        mkdirp: (path: string) => mkdir(path, { recursive: true }),
        readFile,
        writeFile,
        hostAlias: (host: AppHost) => [host.name, host.alias]
      },
      '../Host/Host': {
        vhostTmpl: async () => ({
          apache: await readFile(join(templates, 'apache.vhost'), 'utf8'),
          apacheSSL: await readFile(join(templates, 'apacheSSL.vhost'), 'utf8')
        })
      },
      '../Host/vhostName': vhostName,
      'lodash-es': await import('lodash-es'),
      '@shared/utils': { isWindows: () => true, pathFixedToUnix: unixPath }
    },
    { global: { Server: { BaseDir: root } } }
  )

  const host: AppHost = {
    id: 976510,
    name: originalDomain,
    alias,
    root: site,
    useSSL: true,
    autoSSL: false,
    ssl: { cert, key },
    port: {
      apache: httpPort,
      apache_ssl: httpsPort,
      nginx: 80,
      nginx_ssl: 443,
      caddy: 80,
      caddy_ssl: 443
    },
    envFile: '',
    url: '',
    nginx: { rewrite: '' },
    phpVersion: fastCgiPort - 9000,
    reverseProxy: [{ path: '/api/', url: 'http://' + loopback + ':' + upstreamPort + '/' }]
  }
  await makeApacheConf(host)
  const moduleDir = join(dirname(dirname(apacheBin)), 'modules')
  const modules = [
    'access_compat',
    'authz_core',
    'dir',
    'filter',
    'deflate',
    'headers',
    'log_config',
    'mime',
    'rewrite',
    'proxy',
    'proxy_http',
    'proxy_fcgi',
    'ssl'
  ]
  const vhost = join(root, 'vhost', 'apache', host.id + '.conf')
  const log = join(root, 'vhost', 'logs', host.id + '-access_log')

  const php = start(phpCgiBin, [
    '-n',
    '-d',
    'cgi.force_redirect=0',
    '-b',
    loopback + ':' + fastCgiPort
  ])
  async function launch(port: number, domain: string) {
    await writeFile(
      apacheConfig,
      [
        'ServerRoot ' + quote(root),
        'PidFile ' + quote(join(root, 'httpd.pid')),
        'ServerName ' + domain,
        'Listen ' + loopback + ':' + port,
        'Listen ' + loopback + ':' + httpsPort,
        'ErrorLog ' + quote(fixtureLog),
        ...modules.map(
          (module) =>
            'LoadModule ' + module + '_module ' + quote(join(moduleDir, 'mod_' + module + '.so'))
        ),
        'TypesConfig ' + quote(join(dirname(moduleDir), 'conf', 'mime.types')),
        'LogFormat "%h %r %>s" combined',
        'Include ' + quote(vhost)
      ].join('\n') + '\n'
    )
    const args = ['-d', root, '-f', apacheConfig]
    await run(apacheBin, [...args, '-t'], { cwd: root, windowsHide: true, timeout: 10000 })
    const server = start(apacheBin, [...args, '-X'])
    for (let attempt = 0; attempt < 100 && !server.closed; attempt++) {
      if (
        await get(port, domain, '/index.html').then(
          (response) => response.body === 'fixture website',
          () => false
        )
      )
        return server
      await sleep(50)
    }
    throw new Error(
      'Apache did not serve its fixture: ' +
        server.logs +
        '\n' +
        (await readFile(fixtureLog, 'utf8').catch(() => ''))
    )
  }

  const apache = await launch(httpPort, originalDomain)
  assert.deepEqual(await get(httpPort, alias, '/friendly'), {
    status: 200,
    body: 'fixture website'
  })
  assert.deepEqual(await get(httpsPort, originalDomain, '/friendly', ca), {
    status: 200,
    body: 'fixture website'
  })
  assert.deepEqual(await get(httpPort, originalDomain, '/api/ping'), {
    status: 200,
    body: 'fixture upstream: /ping'
  })
  assert.deepEqual(await get(httpsPort, originalDomain, '/api/ping', ca), {
    status: 200,
    body: 'fixture upstream: /ping'
  })
  const runtime = await get(httpPort, originalDomain, '/runtime.php')
  assert.equal(
    runtime.status,
    200,
    php.logs + '\n' + (await readFile(join(root, 'vhost', 'logs', host.id + '-error_log'), 'utf8'))
  )
  assert.match(runtime.body, /^fixture PHP \d+\.\d+/)

  const updated: AppHost = {
    ...host,
    name: newDomain,
    alias: newDomain,
    port: { ...host.port, apache: changedPort },
    reverseProxy: [{ ...host.reverseProxy![0], path: '/new-api/' }]
  }
  await updateApacheConf(updated, host)
  const editedConfig = await readFile(vhost, 'utf8')
  await updateApacheConf(updated, updated)
  assert.equal(await readFile(vhost, 'utf8'), editedConfig)
  await apache.stop()
  const restarted = await launch(changedPort, newDomain)
  assert.deepEqual(await get(changedPort, newDomain, '/new-api/ping'), {
    status: 200,
    body: 'fixture upstream: /ping'
  })
  assert.deepEqual(await get(httpsPort, newDomain, '/new-api/ping', ca), {
    status: 200,
    body: 'fixture upstream: /ping'
  })
  assert.equal((await get(changedPort, newDomain, '/api/ping')).status, 404)
  assert.equal((await get(httpsPort, newDomain, '/api/ping', ca)).status, 404)
  assert.deepEqual(await get(httpsPort, newDomain, '/friendly', ca), {
    status: 200,
    body: 'fixture website'
  })
  assert.match(await readFile(log, 'utf8'), /GET \/new-api\/ping/)
  await updateApacheConf({ ...updated, reverseProxy: [] }, updated)
  await restarted.stop()
  await launch(changedPort, newDomain)
  assert.equal((await get(changedPort, newDomain, '/new-api/ping')).status, 404)
  assert.equal((await get(httpsPort, newDomain, '/new-api/ping', ca)).status, 404)
  console.log(
    'Windows Apache served generated HTTP, TLS, rewrites, FastCGI and HTTP/HTTPS reverse proxy settings. The isolated server applied hostname, port and route edits and route removal after restarting.'
  )
} finally {
  await Promise.all(children.map((child) => child.stop()))
  await release(upstream)
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}
