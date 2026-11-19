import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { delimiter, isAbsolute, join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { promisify } from 'node:util'
import { loadIsolated } from './helpers/load-isolated'
import type { TomcatSiteHost } from '../src/fork/module/Tomcat/Site'

const [, , java, catalinaHome, openssl] = process.argv
// Use the paths from a Tomcat distribution with RewriteValve support, such as Tomcat 9.
assert(
  java && catalinaHome,
  'Provide the absolute java executable and Tomcat distribution directory. Provide OpenSSL to exercise HTTPS.'
)
assert([java, catalinaHome, ...(openssl ? [openssl] : [])].every(isAbsolute))
await Promise.all(
  [java, join(catalinaHome, 'bin', 'bootstrap.jar'), ...(openssl ? [openssl] : [])].map((file) =>
    access(file)
  )
)

const root = await mkdtemp(join(tmpdir(), 'pqt-native-tomcat-'))
const serverXml = join(root, 'conf', 'server.xml')
const domain = 'pqt-tomcat.test'
const name = 'fixture-tomcat'
const body = 'Tomcat external context fixture'
const probes = [createServer(), createServer(), createServer()]
const processes: { stop: () => Promise<void> }[] = []

async function ports() {
  return Promise.all(
    probes.map(async (socket) => {
      socket.listen({ host: '127.0.0.1', port: 0, exclusive: true })
      await once(socket, 'listening')
      const address = socket.address()
      assert(address && typeof address !== 'string')
      return address.port
    })
  )
}

const closeProbe = (socket: ReturnType<typeof createServer>) =>
  new Promise<void>((done) => socket.close(() => done()))

function get(port: number, path: string, ca?: Buffer, host = domain) {
  return new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
    const request = (ca ? httpsRequest : httpRequest)(
      {
        hostname: '127.0.0.1',
        port,
        path,
        headers: { Host: host },
        agent: false,
        ...(ca ? { servername: host, ca } : {})
      },
      (res) => {
        res.setEncoding('utf8')
        let body = ''
        res.on('data', (data) => {
          body += data
        })
        res.once('end', () => resolve({ status: res.statusCode, body }))
        res.once('error', reject)
      }
    )
    request.setTimeout(1000, () => request.destroy(new Error('Timeout requesting ' + path)))
    request.once('error', reject)
    request.end()
  })
}

async function start(port: number, path: string) {
  const environment = await readFile(serverXml, 'utf8')
  // The app binds connectors on its configured interface. The fixture narrows
  // only their bind address to loopback before running the generated file.
  await writeFile(serverXml, environment.replace(/<Connector\b/g, '<Connector address="127.0.0.1"'))
  const bootstrap = join(catalinaHome, 'bin', 'bootstrap.jar')
  const logging = join(catalinaHome, 'bin', 'tomcat-juli.jar')
  const env = { ...process.env }
  for (const option of ['JAVA_TOOL_OPTIONS', '_JAVA_OPTIONS', 'JDK_JAVA_OPTIONS'])
    delete env[option]
  const child = spawn(
    java,
    [
      '-Dcatalina.base=' + root,
      '-Dcatalina.home=' + catalinaHome,
      '-Djava.io.tmpdir=' + join(root, 'temp'),
      '-classpath',
      [bootstrap, logging].join(delimiter),
      'org.apache.catalina.startup.Bootstrap',
      'start'
    ],
    { env, windowsHide: true, cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  let closed = false
  let logs = ''
  child.on('error', (error) => {
    logs += String(error)
  })
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (data) => {
      logs = (logs + data).slice(-12000)
    })
  }
  const ended = new Promise<void>((done) =>
    child.once('close', () => {
      closed = true
      done()
    })
  )
  const fixture = {
    async stop() {
      if (!closed) child.kill()
      await ended
    }
  }
  processes.push(fixture)
  for (let attempt = 0; attempt < 120 && !closed; attempt++) {
    if (
      await get(port, path).then(
        (res) => res.body === body,
        () => false
      )
    )
      return fixture
    await sleep(100)
  }
  throw new Error(
    'Tomcat did not serve the generated context.\n' +
      logs +
      '\n' +
      (await readFile(serverXml, 'utf8'))
  )
}

try {
  const [oldPort, sslPort, newPort] = await ports()
  await Promise.all(probes.map(closeProbe))
  await mkdir(join(root, 'conf'))
  await Promise.all(
    ['catalina.properties', 'web.xml'].map((name) =>
      copyFile(join(catalinaHome, 'conf', name), join(root, 'conf', name))
    )
  )
  const appBase = join(root, 'sites')
  const docBase = join(root, 'external context')
  const manualBase = join(root, 'manual')
  await Promise.all(
    [
      appBase,
      docBase,
      manualBase,
      join(root, 'temp'),
      join(root, 'logs'),
      join(root, 'vhost', 'logs')
    ].map((path) => mkdir(path, { recursive: true }))
  )
  await writeFile(join(docBase, 'index.html'), body)
  await writeFile(
    serverXml,
    '<Server port="-1" shutdown="SHUTDOWN"><Service name="Catalina"><Engine name="Catalina" defaultHost="localhost"><Host name="localhost" appBase="manual" autoDeploy="false"/></Engine></Service></Server>\n'
  )
  const cert = join(root, 'cert.pem')
  const key = join(root, 'key.pem')
  let ca: Buffer | undefined
  if (openssl) {
    const config = join(root, 'openssl.cnf')
    await writeFile(config, '[req]\ndistinguished_name = dn\n[dn]\n')
    await promisify(execFile)(
      openssl,
      [
        'req',
        '-config',
        config,
        '-new',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-keyout',
        key,
        '-out',
        cert,
        '-subj',
        '/CN=' + domain,
        '-addext',
        'subjectAltName=DNS:' + domain
      ],
      { cwd: root, windowsHide: true, timeout: 10000 }
    )
    ca = await readFile(cert)
  }
  const fn = {
    existsSync,
    mkdirp: (path: string) => mkdir(path, { recursive: true }),
    readFile,
    readdir,
    realpath,
    stat,
    writeFile,
    remove: (path: string) => rm(path, { force: true })
  }
  const site = await loadIsolated('src/fork/module/Tomcat/Site.ts', { '../../Fn': fn })
  const { reconcileTomcatBase } = await loadIsolated(
    'src/fork/module/Tomcat/ServerXML.ts',
    {
      '../../Fn': fn,
      '../Host/HostFile': {},
      '../Host/Host': {},
      './Site': site
    },
    { global: { Server: { BaseDir: root } } }
  )
  const host: TomcatSiteHost = {
    id: 976511,
    type: 'tomcat',
    name: domain,
    alias: '',
    projectName: name,
    envFile: '',
    url: '',
    nginx: { rewrite: '' },
    root: appBase,
    useSSL: !!ca,
    autoSSL: false,
    ssl: { cert, key },
    port: {
      nginx: 80,
      nginx_ssl: 443,
      apache: 80,
      apache_ssl: 443,
      caddy: 80,
      caddy_ssl: 443,
      tomcat: oldPort,
      tomcat_ssl: sslPort
    },
    tomcat: {
      contexts: [{ id: 'fixture', path: '/first', docBase }],
      rewrite: { enabled: true, content: 'RewriteRule ^/friendly$ /first/index.html [L]' }
    }
  }
  await reconcileTomcatBase(root, [host])
  const original = await start(oldPort, '/first/index.html')
  assert.deepEqual(await get(oldPort, '/friendly'), { status: 200, body })
  assert.equal((await get(oldPort, '/first/index.html', undefined, 'localhost')).status, 404)
  if (ca) assert.deepEqual(await get(sslPort, '/friendly', ca), { status: 200, body })
  await original.stop()
  // Regenerate from the startup fixture before applying the port edit so the
  // test's loopback override never accumulates in the production XML.
  await writeFile(
    serverXml,
    (await readFile(serverXml, 'utf8')).replaceAll(' address="127.0.0.1"', '')
  )
  await reconcileTomcatBase(root, [
    {
      ...host,
      port: { ...host.port, tomcat: newPort },
      tomcat: {
        contexts: [{ id: 'fixture', path: '/second', docBase }],
        rewrite: { enabled: false, content: '' }
      }
    }
  ])
  const restarted = await start(newPort, '/second/index.html')
  assert.equal((await get(newPort, '/first/index.html')).status, 404)
  assert.equal((await get(newPort, '/friendly')).status, 404)
  if (ca) assert.deepEqual(await get(sslPort, '/second/index.html', ca), { status: 200, body })
  await restarted.stop()
  console.log(
    'Tomcat served generated ' +
      (ca ? 'HTTP and TLS' : 'HTTP') +
      ' connectors, an external context and a rewrite. A restart applied the changed port and context and removed the old route.'
  )
} finally {
  await Promise.all(processes.map((process) => process.stop()))
  await Promise.all(probes.map(closeProbe))
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}
