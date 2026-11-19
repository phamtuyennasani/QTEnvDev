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
import { makeCaddyConf, updateCaddyConf } from '../src/fork/module/Caddy/Host'
import { makeFrankenPHPConf, updateFrankenPHPConf } from '../src/fork/module/FrankenPHP/Host'

const [, , caddyBin, frankenBin, opensslBin] = process.argv
assert.equal(process.platform, 'win32', 'This fixture exercises the Windows templates.')
assert(
  caddyBin && frankenBin && opensslBin,
  'Provide caddy.exe, frankenphp.exe, and openssl.exe paths.'
)
await Promise.all([caddyBin, frankenBin, opensslBin].map((file) => access(file)))

const temp = resolve(tmpdir())
const workspace = await mkdtemp(join(temp, 'pqt caddy sites-'))
const oldServer = global.Server
const run = promisify(execFile)
const loopback = '127.0.0.1'
const quote = (path: string) => JSON.stringify(path.replaceAll('\\', '/'))
const options = {
  cwd: workspace,
  windowsHide: true,
  env: { ...process.env, XDG_DATA_HOME: workspace, XDG_CONFIG_HOME: workspace, APPDATA: workspace }
}
const upstream = createServer((request, response) => {
  response.end(`${request.headers['x-forwarded-proto']} upstream ${request.url}`)
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
  return new Promise<{ status?: number; body: string; location?: string }>((resolve, reject) => {
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
        response.once('end', () =>
          resolve({ status: response.statusCode, body, location: response.headers.location })
        )
      }
    )
    request.setTimeout(1000, () => request.destroy(new Error('Fixture request timed out')))
    request.once('error', reject)
    request.end()
  })
}

async function certificate(name: string, alias: string) {
  const cert = join(workspace, `${name} certificate.pem`)
  const key = join(workspace, `${name} private key.pem`)
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
      `/CN=${name}`,
      '-addext',
      `subjectAltName=DNS:${name},DNS:${alias}`
    ],
    { ...options, timeout: 10_000 }
  )
  return { cert, key }
}

type Engine = 'caddy' | 'frankenphp'
const engines = {
  caddy: { binary: caddyBin, make: makeCaddyConf, edit: updateCaddyConf },
  frankenphp: { binary: frankenBin, make: makeFrankenPHPConf, edit: updateFrankenPHPConf }
}
let stopServer: (() => Promise<void>) | undefined

async function launch(engine: Engine, host: AppHost, staticDir: string) {
  const config = join(workspace, `${engine}.Caddyfile`)
  const vhostDir = join(workspace, 'vhost', engine)
  const tmplName = engine === 'caddy' ? 'Caddyfile' : 'frankenphp.Caddyfile'
  const template = await readFile(join(staticDir, 'tmpl', tmplName), 'utf8')
  const fixtureConfig = template
    .replace('{', '{\n  admin off\n  auto_https disable_redirects\n  default_bind 127.0.0.1\n')
    .replace('##LOG_FILE##', join(workspace, `${engine}.log`).replaceAll('\\', '/'))
    .replace('##VHOST-DIR##/*', `${vhostDir.replaceAll('\\', '/')}/*.conf`)
    .replace('##SSL_ROOT##', join(workspace, 'caddy-storage').replaceAll('\\', '/'))
    .replace('frankenphp {', 'frankenphp {\n    num_threads 2\n    max_threads 2')
  await writeFile(config, fixtureConfig)
  const binary = engines[engine].binary
  const args = ['--config', config, '--adapter', 'caddyfile']
  const { stdout } = await run(binary, ['adapt', ...args], { ...options, timeout: 10_000 })
  const adapted = JSON.parse(stdout)
  const listeners = Object.values(adapted.apps.http.servers).flatMap(
    (server) => (server as { listen: string[] }).listen
  )
  const port = host.port[engine]!
  const tlsPort = host.port[`${engine}_ssl`]!
  assert.deepEqual(listeners.sort(), [loopback + ':' + port, loopback + ':' + tlsPort].sort())

  const child = spawn(binary, ['run', ...args], { ...options, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  let closed = false
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
    const ready = await get(port, host.name, '/welcome.txt').then(
      ({ status }) => status === 200,
      () => false
    )
    if (ready) return
    await sleep(50)
  }
  const log = await readFile(join(workspace, `${engine}.log`), 'utf8').catch(() => '')
  throw new Error(`${engine} did not serve its generated site.\n${output}\n${log.slice(-8192)}`)
}

try {
  const [httpPort, tlsPort, editedHttpPort, editedTlsPort] = await Promise.all(
    reservations.map(bind)
  )
  await Promise.all(reservations.map(release))
  const upstreamPort = await bind(upstream)
  const site = join(workspace, 'site root')
  const editedSite = join(workspace, 'edited site root')
  const staticDir = join(workspace, 'static')
  const templates = join(staticDir, 'tmpl')
  await Promise.all([
    mkdir(site),
    mkdir(editedSite),
    mkdir(join(workspace, 'vhost', 'logs'), { recursive: true })
  ])
  await cp(resolve('static/tmpl/Windows'), templates, { recursive: true })
  for (const file of ['FrankenphpVhost', 'FrankenphpVhostSSL', 'frankenphp.Caddyfile']) {
    await cp(resolve('static/tmpl', file), join(templates, file))
  }
  await writeFile(join(workspace, 'openssl.cnf'), '[req]\ndistinguished_name = dn\n[dn]\n')
  for (const [index, root] of [site, editedSite].entries()) {
    await mkdir(join(root, 'nested'))
    await writeFile(join(root, 'welcome.txt'), `fixture ${index}`)
    await writeFile(
      join(root, 'nested', 'index.php'),
      `<?php echo "PHP result ${index} " . PHP_MAJOR_VERSION;`
    )
  }
  global.Server = { BaseDir: workspace, Static: staticDir } as typeof global.Server

  for (const engine of Object.keys(engines) as Engine[]) {
    const originalName = `original-${engine}.test`
    const originalAlias = `original-${engine}-alias.test`
    const editedName = `edited-${engine}.test`
    const editedAlias = `edited-${engine}-alias.test`
    const [originalCert, editedCert] = await Promise.all([
      certificate(originalName, originalAlias),
      certificate(editedName, editedAlias)
    ])
    const [originalCa, editedCa] = await Promise.all([
      readFile(originalCert.cert),
      readFile(editedCert.cert)
    ])
    const host: AppHost = {
      id: 976511,
      name: originalName,
      alias: originalAlias,
      root: site,
      useSSL: true,
      autoSSL: false,
      ssl: originalCert,
      envFile: '',
      url: '',
      port: {
        nginx: 80,
        nginx_ssl: 443,
        apache: 80,
        apache_ssl: 443,
        caddy: 80,
        caddy_ssl: 443,
        [engine]: httpPort,
        [`${engine}_ssl`]: tlsPort
      },
      reverseProxy: [{ path: '/api/*', url: `http://${loopback}:${upstreamPort}` }]
    }
    const vhostPath = join(workspace, 'vhost', engine, `${host.id}.conf`)
    await engines[engine].make(host)
    await launch(engine, host, staticDir)
    assert.equal((await get(httpPort, originalAlias, '/welcome.txt')).body, 'fixture 0')
    assert.equal((await get(tlsPort, originalName, '/welcome.txt', originalCa)).body, 'fixture 0')
    assert.equal((await get(httpPort, originalName, '/api/ping')).body, 'http upstream /api/ping')
    assert.equal(
      (await get(tlsPort, originalAlias, '/api/ping', originalCa)).body,
      'https upstream /api/ping'
    )
    const canonical = await get(httpPort, originalAlias, '/nested')
    assert.equal(canonical.status, 308)
    assert.equal(canonical.location, '/nested/')
    if (engine === 'frankenphp') {
      assert.match(
        (await get(tlsPort, originalName, '/nested/', originalCa)).body,
        /^PHP result 0 \d+$/
      )
    }

    const edited: AppHost = {
      ...host,
      name: editedName,
      alias: editedAlias,
      root: editedSite,
      ssl: editedCert,
      port: { ...host.port, [engine]: editedHttpPort, [`${engine}_ssl`]: editedTlsPort },
      reverseProxy: [{ ...host.reverseProxy![0], path: '/moved/*' }]
    }
    await engines[engine].edit(edited, host)
    const updated = await readFile(vhostPath, 'utf8')
    await engines[engine].edit(edited, edited)
    assert.equal(await readFile(vhostPath, 'utf8'), updated)
    await stopServer?.()
    await launch(engine, edited, staticDir)
    assert.equal((await get(editedHttpPort, editedAlias, '/welcome.txt')).body, 'fixture 1')
    assert.equal((await get(editedTlsPort, editedName, '/welcome.txt', editedCa)).body, 'fixture 1')
    assert.equal(
      (await get(editedHttpPort, editedName, '/moved/ping')).body,
      'http upstream /moved/ping'
    )
    assert.equal(
      (await get(editedTlsPort, editedAlias, '/moved/ping', editedCa)).body,
      'https upstream /moved/ping'
    )
    assert.notEqual((await get(editedHttpPort, originalAlias, '/welcome.txt')).body, 'fixture 1')
    assert.doesNotMatch(
      (await get(editedTlsPort, editedAlias, '/api/ping', editedCa)).body,
      /upstream/
    )
    if (engine === 'frankenphp') {
      assert.match((await get(editedHttpPort, editedName, '/nested/')).body, /^PHP result 1 \d+$/)
    }
    const noProxy = { ...edited, reverseProxy: [] }
    await engines[engine].edit(noProxy, edited)
    await stopServer?.()
    await launch(engine, noProxy, staticDir)
    assert.doesNotMatch((await get(editedHttpPort, editedName, '/moved/ping')).body, /upstream/)
    assert.doesNotMatch(
      (await get(editedTlsPort, editedAlias, '/moved/ping', editedCa)).body,
      /upstream/
    )
    assert.match(
      await readFile(join(workspace, 'vhost', 'logs', `${host.id}.${engine}.log`), 'utf8'),
      /\/moved\/ping/
    )
    await stopServer?.()
    console.log(
      `Windows ${engine} served generated sites over HTTP and TLS, applied proxy and website edits, and removed both proxy routes.${engine === 'frankenphp' ? ' PHP executed in the embedded runtime.' : ''}`
    )
  }
} finally {
  await stopServer?.()
  await Promise.all([upstream, ...reservations].map(release))
  global.Server = oldServer
  assert.equal(dirname(resolve(workspace)), temp)
  await rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}
