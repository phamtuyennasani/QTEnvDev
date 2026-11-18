import { computed, reactive } from 'vue'
import { showTask, closeTask, showNotice } from './app'
import { readServiceSnapshot, runServiceLifecycle } from '../adapters/serviceAdapter'

export type ServiceState = 'running' | 'stopped' | 'warning' | 'busy'
export type ServiceItem = { name: string; kind: string; version: string; port: number; state: ServiceState; uptime: string }

const catalog: Array<[string, string, number]> = [['Apache', 'Web server', 80], ['Nginx', 'Web server', 8080], ['Caddy', 'Web server', 443], ['PHP', 'Runtime', 9000], ['PHP-FPM', 'Runtime', 9070], ['MySQL', 'Database', 3306], ['MariaDB', 'Database', 3307], ['PostgreSQL', 'Database', 5432], ['Redis', 'Cache', 6379], ['MongoDB', 'Database', 27017], ['ClickHouse', 'Database', 8123], ['Elasticsearch', 'Search', 9200], ['RabbitMQ', 'Messaging', 5672], ['Memcached', 'Cache', 11211], ['Mailpit', 'Email', 8025], ['Minio', 'Object storage', 9001], ['Qdrant', 'Vector database', 6333], ['Typesense', 'Search', 8108], ['Meilisearch', 'Search', 7700], ['Neo4j', 'Graph database', 7474], ['Consul', 'Service discovery', 8500], ['Podman', 'Container engine', 8081], ['Cloudflared', 'Tunnel', 7844], ['HTTP Serve', 'Web server', 8787], ['RoadRunner', 'Application server', 8082], ['FrankenPHP', 'Application server', 8083], ['N8N', 'Automation', 5678]]
const services = reactive<ServiceItem[]>(catalog.map(([name, kind, port]) => ({ name, kind, version: '—', port, state: 'stopped' as ServiceState, uptime: '—' })))
const selected = reactive<{ service?: ServiceItem }>({ service: services[0] })
let operationSequence = 0
const activeOperations = new WeakMap<ServiceItem, number>()
const run = async (service: ServiceItem, action: 'Start' | 'Stop' | 'Restart') => {
  if (service.state === 'busy') return false
  const operationId = ++operationSequence
  activeOperations.set(service, operationId)
  service.state = 'busy'; selected.service = service
  showTask(action + ' ' + service.name, 'Waiting for the service lifecycle to complete.')
  try {
    const adapter = await runServiceLifecycle(service.name, action.toLowerCase() as 'start' | 'stop' | 'restart')
    if (activeOperations.get(service) !== operationId) return false
    if (!adapter.connected || adapter.result !== true) {
      service.state = 'warning'; showNotice(service.name + ': ' + (typeof adapter.result === 'string' ? adapter.result : 'The service did not report success.')); return false
    }
    service.state = action === 'Stop' ? 'stopped' : 'running'
    showNotice(service.name + ' ' + action.toLowerCase() + ' completed'); return true
  } catch (error) {
    service.state = 'warning'; showNotice(service.name + ': ' + (error instanceof Error ? error.message : String(error))); return false
  } finally {
    if (activeOperations.get(service) === operationId) { activeOperations.delete(service); closeTask() }
  }
}
const runGroup = async () => {
  const pending = services.filter((service) => service.state !== 'running' && service.state !== 'busy')
  const results = []; for (const service of pending) results.push(await run(service, 'Start')); return { completed: results.filter(Boolean).length, failed: results.filter((item) => !item).length }
}
const refresh = async () => {
  await Promise.all(services.map(async (service) => {
    if (service.state === 'busy') return
    const snapshot = await readServiceSnapshot(service.name)
    if (!snapshot.connected) return
    service.state = snapshot.running ? 'running' : 'stopped'
    if (snapshot.version) service.version = snapshot.version
  }))
}
export const serviceController = { services, selected, runningCount: computed(() => services.filter((service) => service.state === 'running').length), select(service: ServiceItem) { selected.service = service }, run, runGroup, refresh }
