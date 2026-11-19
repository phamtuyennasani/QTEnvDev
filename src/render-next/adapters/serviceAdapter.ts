import type { AllAppModule } from '@/core/type'
import type { SoftInstalled } from '@shared/app'
import { BrewStore } from '@/store/brew'
import { registerLifecycle } from './lifecycleAdapter'

export const serviceModuleFlags: Record<string, AllAppModule> = { Apache: 'apache', Nginx: 'nginx', Caddy: 'caddy', Tomcat: 'tomcat', PHP: 'php', 'PHP-FPM': 'php-fpm', MySQL: 'mysql', MariaDB: 'mariadb', PostgreSQL: 'postgresql', Redis: 'redis', MongoDB: 'mongodb', ClickHouse: 'clickhouse', Elasticsearch: 'elasticsearch', RabbitMQ: 'rabbitmq', Memcached: 'memcached', Mailpit: 'mailpit', Minio: 'minio', Qdrant: 'qdrant', Typesense: 'typesense', Meilisearch: 'meilisearch', Neo4j: 'neo4j', Consul: 'consul', Podman: 'podman', Cloudflared: 'cloudflared', 'Cloudflare Tunnel': 'cloudflare-tunnel', 'Pure-FTPd': 'pure-ftpd', 'FTP Server': 'ftp-srv', 'HTTP Serve': 'httpserver', RoadRunner: 'roadrunner', FrankenPHP: 'frankenphp', N8N: 'n8n' }

type Lifecycle = 'start' | 'stop' | 'restart'
export type AdapterResult = { connected: boolean; result: string | boolean }
export function currentServiceVersion(name: string) {
  const flag = serviceModuleFlags[name]
  if (!flag) return undefined
  try {
    const module = BrewStore().module(flag === 'php-fpm' ? 'php' : flag)
    return BrewStore().currentVersion(flag) ?? module.installed.find((item) => item.run) ?? module.installed[0]
  } catch { return undefined }
}

export async function serviceFileContext(flag: AllAppModule, version?: SoftInstalled): Promise<unknown[]> {
  if (!version?.version) return []
  if (flag === 'tomcat') {
    const { TomcatSetup, tomcatCatalinaBase } = await import('@/components/Tomcat/setup')
    await TomcatSetup.init()
    return [tomcatCatalinaBase(version)]
  }
  if (flag === 'postgresql') {
    const { postgreSqlDataDirectory } = await import('@/components/PostgreSql/lifecycle')
    return [await postgreSqlDataDirectory({ version: version.version, bin: version.bin })]
  }
  return []
}

/**
 * The new renderer talks to service lifecycle through this adapter. It keeps
 * UI modules independent from legacy component instances while reusing the
 * established ModuleInstalledItem lifecycle when the host has initialized it.
 */
export async function runServiceLifecycle(name: string, action: Lifecycle): Promise<AdapterResult> {
  const flag = serviceModuleFlags[name]
  if (!flag || !window.Server?.DataDirectoryReady) return { connected: false, result: 'The service is unavailable or the desktop connection is not ready.' }
  try {
    const module = BrewStore().module(flag === 'php-fpm' ? 'php' : flag)
    if (!await module.fetchInstalled(false, { fresh: false })) throw new Error('Installed versions could not be refreshed.')
    await registerLifecycle(flag)
    const item = BrewStore().currentVersion(flag) ?? module.installed[0]
    if (!item) return { connected: true, result: 'No installed version. Open Manage packages to install one first.' }
    const result = action === 'start' ? await item.start() : action === 'stop' ? await item.stop() : await item.restart()
    return { connected: true, result }
  } catch (error) {
    return { connected: false, result: error instanceof Error ? error.message : String(error) }
  }
}

export async function readServiceSnapshot(name: string): Promise<{ connected: boolean; installed: boolean; running: boolean; version?: string; port?: number; reason?: 'unavailable' | 'unknown' }> {
  const flag = serviceModuleFlags[name]
  if (!flag) return { connected: false, installed: false, running: false, reason: 'unavailable' }
  try {
    if (!window.Server?.DataDirectoryReady) return { connected: false, installed: false, running: false, reason: 'unknown' }
    const module = BrewStore().module(flag === 'php-fpm' ? 'php' : flag)
    if (!await module.fetchInstalled(false, { fresh: false })) throw new Error('Installed versions could not be refreshed.')
    const item = module.installed.find((version) => version.run) ?? BrewStore().currentVersion(module.typeFlag) ?? module.installed[0]
    return { connected: true, installed: Boolean(item), running: module.installed.some((version) => version.run), version: item?.version ?? undefined, port: undefined }
  } catch {
    return { connected: false, installed: false, running: false, reason: 'unknown' }
  }
}
