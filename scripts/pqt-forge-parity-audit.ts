import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const modulesDir = join(root, 'src/fork/module')
const onlineProviders = readdirSync(modulesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .filter((entry) => readFileSync(join(modulesDir, entry.name, 'index.ts'), 'utf8').includes('fetchAllOnlineVersion'))
  .map((entry) => entry.name)
  .filter((name) => !['Base', 'Version'].includes(name))
  .sort()
const catalog = readFileSync(join(root, 'src/render-next/packages/catalog.ts'), 'utf8')
const aliases: Record<string, string> = { GoLang: 'golang', MailPit: 'mailpit', Mariadb: 'mariadb', MeiliSearch: 'meilisearch', MkCert: 'mkcert', Mongodb: 'mongodb', Mysql: 'mysql', N8N: 'n8n', Neo4j: 'neo4j', Nginx: 'nginx', Php: 'php', Postgresql: 'postgresql', Qdrant: 'qdrant', RabbitMQ: 'rabbitmq', Redis: 'redis', Rnacos: 'rnacos', RoadRunner: 'roadrunner', RustFS: 'rustfs', SwooleCli: 'swoole-cli', TemporalCli: 'temporal-cli', Typesense: 'typesense', ZincSearch: 'zincsearch', Cloudflared: 'cloudflared', CloudflareTunnel: 'cloudflare-tunnel', CliProxyAPI: 'cliproxyapi', DotNet: 'dotnet', ETCD: 'etcd', FTPSrv: 'ftp-srv', PureFtpd: 'pure-ftpd' }
const missing = onlineProviders.map((name) => aliases[name] || name.toLowerCase().replace(/\.win$/, '')).filter((flag) => !catalog.includes(`'${flag}'`))
if (missing.length) throw new Error(`Online legacy providers missing from PQT Forge catalog: ${missing.join(', ')}`)
console.log(`PQT Forge parity audit passed: ${onlineProviders.length} legacy online package providers are represented in the new catalog.`)
