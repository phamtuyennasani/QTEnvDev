import type { AllAppModule } from '@/core/type'
import { BrewStore } from '@/store/brew'

const flags: Record<string, AllAppModule> = { MySQL: 'mysql', MariaDB: 'mariadb', PostgreSQL: 'postgresql', Redis: 'redis', MongoDB: 'mongodb', ClickHouse: 'clickhouse', Neo4j: 'neo4j', Elasticsearch: 'elasticsearch', Qdrant: 'qdrant' }
export async function refreshDatabase(name: string): Promise<{ connected: boolean; installed: boolean; running: boolean; version?: string }> {
  const flag = flags[name]
  if (!flag) return { connected: false, installed: false, running: false }
  try {
    const module = BrewStore().module(flag)
    if (!await module.fetchInstalled(false, { fresh: false })) throw new Error('Installed versions could not be refreshed.')
    const item = module.installed.find((version) => version.run) ?? BrewStore().currentVersion(flag) ?? module.installed[0]
    return { connected: true, installed: Boolean(item), running: module.installed.some((version) => version.run), version: item?.version ?? undefined }
  } catch { return { connected: false, installed: false, running: false } }
}
