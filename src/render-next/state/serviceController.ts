import { computed, reactive } from 'vue'
import { isBuiltinModuleVisible } from '../moduleVisibility/visibility'
import { showTask, closeTask, showNotice } from './app'
import { readServiceSnapshot, runServiceLifecycle, serviceModuleFlags } from '../adapters/serviceAdapter'

export type ServiceState = 'running' | 'stopped' | 'not-installed' | 'warning' | 'busy' | 'unavailable' | 'unknown'
export type ServiceItem = { name: string; kind: string; version: string; port?: number; state: ServiceState; uptime?: string }

const kindFor = (name: string) => /SQL|Redis|Mongo|ClickHouse|Elastic|Qdrant|Neo4j|Memcached/i.test(name) ? 'Database' : /PHP|Node|Python|Go|Java/i.test(name) ? 'Runtime' : /FTP|Mail|Rabbit|N8N|Cloud/i.test(name) ? 'Integration' : 'Service'
const services = reactive<ServiceItem[]>(Object.keys(serviceModuleFlags).map((name) => ({ name, kind: kindFor(name), version: '—', state: 'unknown' as ServiceState })))
const visibleServices = computed(() => services.filter((service) => isBuiltinModuleVisible(serviceModuleFlags[service.name])))
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
  const pending = visibleServices.value.filter((service) => service.state !== 'running' && service.state !== 'busy')
  const results = []; for (const service of pending) results.push(await run(service, 'Start')); return { completed: results.filter(Boolean).length, failed: results.filter((item) => !item).length }
}
const refresh = async (targets = visibleServices.value) => {
  await Promise.all(targets.map(async (service) => {
    if (service.state === 'busy') return
    const snapshot = await readServiceSnapshot(service.name)
    if (activeOperations.has(service)) return
    if (!snapshot.connected) { service.state = snapshot.reason === 'unavailable' ? 'unavailable' : 'unknown'; service.version = '—'; service.uptime = undefined; service.port = undefined; return }
    service.state = !snapshot.installed ? 'not-installed' : snapshot.running ? 'running' : 'stopped'
    service.version = snapshot.version || '—'
    service.port = snapshot.port
  }))
}
export const serviceController = { services, visibleServices, selected, runningCount: computed(() => visibleServices.value.filter((service) => service.state === 'running').length), select(service: ServiceItem) { selected.service = service }, run, runGroup, refresh }
