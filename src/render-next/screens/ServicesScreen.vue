<template>
  <section class="screen services-screen">
    <header class="page-header">
      <div><p class="eyebrow">WORKSPACE / SERVICES</p><h1>Services</h1><p class="subtitle">Control the processes that power your local stack.</p></div>
      <div class="header-actions service-entry-actions">
        <button v-if="isBuiltinModuleVisible('httpserver')" class="action-button" @click="navigateNext('http-serve')">HTTP Serve</button>
        <button v-if="isBuiltinModuleVisible('dns')" class="action-button" @click="navigateNext('dns-server')">DNS Server</button>
        <button v-if="isBuiltinModuleVisible('ftp-srv') || isBuiltinModuleVisible('pure-ftpd')" class="action-button" @click="navigateNext('ftp-accounts')">FTP Accounts</button>
        <button v-if="isBuiltinModuleVisible('podman')" class="action-button" @click="navigateNext('podman')">Podman</button>
        <button v-if="isBuiltinModuleVisible('startup-group')" class="primary-button" @click="startGroup"><span class="button-glyph">▶</span> Start group</button>
      </div>
    </header>
    <div class="service-toolbar"><label class="search-box"><span>⌕</span><input v-model="query" placeholder="Filter services" /></label><div class="filter-tabs"><button v-for="tab in tabs" :key="tab" :class="{ active: filter === tab }" @click="filter = tab">{{ tab }}</button></div></div>
    <div class="services-layout">
      <article class="panel services-list-panel">
        <div class="list-heading"><span>Service</span><span>Version</span><span>Port</span><span>Status</span></div>
        <button v-for="service in filteredServices" :key="service.name" class="service-item" :class="{ selected: selectedService?.name === service.name }" @click="serviceController.select(service)">
          <span class="service-primary"><i class="status-dot" :class="`status-dot--${service.state}`"></i><span><b>{{ service.name }}</b><small>{{ service.kind }}</small></span></span>
          <code>{{ service.version }}</code><code>{{ service.port ?? '—' }}</code>
          <span class="state-label" :class="`state-label--${service.state}`">{{ formatState(service.state) }}</span>
        </button>
        <p v-if="filteredServices.length === 0" class="empty-copy">No services match this filter.</p>
      </article>
      <article v-if="selectedService" class="panel service-detail-panel">
        <div class="detail-top"><div><h2>{{ selectedService.name }}</h2><p class="detail-kind">{{ selectedService.kind }} · <code>{{ selectedService.version }}</code></p></div><i class="large-status-dot" :class="`status-dot--${selectedService.state}`"></i></div>
        <div class="detail-status">
          <span class="status-dot" :class="`status-dot--${selectedService.state}`"></span>
          <b>{{ formatState(selectedService.state) }}</b>
          <span v-if="selectedService.state === 'running' && selectedService.uptime" class="uptime">{{ selectedService.uptime }} uptime</span>
        </div>
        <div class="detail-facts"><div><span>Endpoint</span><code>{{ selectedService.port ? 'localhost:' + selectedService.port : 'Not reported' }}</code></div></div>
        <div v-if="selectedService.name === 'Cloudflare Tunnel'" class="detail-actions">
          <button class="action-button action-button--primary" @click="tunnelsOpen = true">Manage tunnels</button>
        </div>
        <template v-else>
        <div class="detail-actions">
          <button class="action-button action-button--primary" :disabled="selectedService.state === 'busy'" @click="serviceController.run(selectedService, selectedService.state === 'running' ? 'Restart' : 'Start')">{{ selectedService.state === 'running' ? 'Restart' : 'Start' }}</button>
          <button class="action-button" :disabled="selectedService.state !== 'running'" @click="serviceController.run(selectedService, 'Stop')">Stop</button>
          <button
            v-if="dashboard && selectedService.state === 'running'"
            class="action-button"
            :disabled="serviceDashboardController.isOpening(dashboard.flag)"
            @click="serviceDashboardController.open(dashboard.flag)"
          >{{ serviceDashboardController.openingLabel(dashboard.flag) ?? dashboard.label }}</button>
        </div>
        <ServiceDirectory
          v-if="directoryFlag"
          :key="directoryFlag"
          :flag="directoryFlag"
          :has-version="selectedService.version !== '—'"
        />
        <div class="detail-actions"><button class="action-button" @click="openFiles('config')">Configuration</button><button class="action-button" @click="openFiles('log')">Logs</button></div>
        <button v-if="installedFlag" class="action-button" @click="versionsOpen = true">Installed versions</button>
        <PackageBrowser v-if="selectedFlag" :key="selectedFlag" :flag="selectedFlag" :title="selectedService.name" />
        </template>
      </article>
    </div>
    <ServiceFilesDialog v-if="selectedService" v-model="filesOpen" :name="selectedService.name" :version="selectedService.version" :kind="fileKind" />
    <InstalledVersionsDialog
      v-if="versionsOpen && installedFlag && selectedService"
      :key="installedFlag"
      :flag="installedFlag"
      :title="selectedService.name"
      @close="versionsOpen = false"
    />
    <TunnelDialog v-if="tunnelsOpen" @close="closeTunnels" />
  </section>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { BrewStore } from '@/store/brew'
import { serviceController, type ServiceState } from '../state/serviceController'
import { navigateNext, showNotice } from '../state/app'
import PackageBrowser from '../components/PackageBrowser.vue'
import ServiceFilesDialog from '../components/ServiceFilesDialog.vue'
import { packageFlagForName } from '../packages/catalog'
import { startupGroupController } from '../state/startupGroupController'
import { isBuiltinModuleVisible } from '../moduleVisibility/visibility'
import { serviceModuleFlags } from '../adapters/serviceAdapter'
import ServiceDirectory from '../serviceDirectories/ServiceDirectory.vue'
import { isServiceDirectoryFlag } from '../serviceDirectories/controller'
import { serviceDashboardController, serviceDashboardLabel } from '../serviceDashboards/controller'
const query = ref(''); const filter = ref('All'); const tabs = ['All', 'Running', 'Stopped']
const selectedService = computed(() => {
  const services = serviceController.visibleServices.value
  return services.find((service) => service === serviceController.selected.service) ?? services[0]
})
const filteredServices = computed(() => serviceController.visibleServices.value.filter((service) => { const textMatch = `${service.name} ${service.kind}`.toLowerCase().includes(query.value.toLowerCase()); const stateMatch = filter.value === 'All' || (filter.value === 'Running' ? service.state === 'running' : service.state === 'stopped'); return textMatch && stateMatch }))
const formatState = (state: ServiceState) => state === 'busy' ? 'Working…' : state === 'unknown' ? 'Unknown' : state === 'unavailable' ? 'Unavailable' : state === 'not-installed' ? 'Not installed' : state[0].toUpperCase() + state.slice(1)
const notify = (message: string) => showNotice(message)
const startGroup = async () => { if (startupGroupController.defaultGroup.value) { await startupGroupController.runDefault(); return } const result = await serviceController.runGroup(); notify(result.completed + ' services started; ' + result.failed + ' failed') }
const selectedFlag = computed(() => selectedService.value ? packageFlagForName(selectedService.value.name) : undefined)
const moduleFlag = computed(() => selectedService.value && serviceModuleFlags[selectedService.value.name])
const directoryFlag = computed(() => {
  const flag = moduleFlag.value
  return flag && isServiceDirectoryFlag(flag) ? flag : undefined
})
const dashboard = computed(() => {
  const flag = moduleFlag.value
  if (!flag) return undefined
  const label = serviceDashboardLabel(flag)
  return label ? { flag, label } : undefined
})
const InstalledVersionsDialog = defineAsyncComponent(() => import('../serviceVersions/InstalledVersionsDialog.vue'))
const TunnelDialog = defineAsyncComponent(() => import('../cloudflareTunnel/TunnelDialog.vue'))
const tunnelsOpen = ref(false)
const closeTunnels = () => {
  tunnelsOpen.value = false
  if (selectedService.value) void serviceController.refresh([selectedService.value])
}
const versionsOpen = ref(false)
const installedFlag = computed(() => {
  if (selectedService.value?.name === 'PHP-FPM') return 'php'
  const flag = selectedFlag.value
  return flag && flag !== 'pure-ftpd' && flag !== 'ftp-srv' && flag !== 'podman' ? flag : undefined
})
const installedRunState = computed(() => {
  if (!installedFlag.value) return ''
  const module = BrewStore().module(installedFlag.value)
  if (module.starting || module.installed.some((item) => item.running)) return ''
  return JSON.stringify(module.installed.map(({ bin, version, run }) => [bin, version, run]))
})
watch(installedRunState, (state) => {
  if (state && selectedService.value) void serviceController.refresh([selectedService.value])
})
const filesOpen = ref(false); const fileKind = ref<'config' | 'log'>('log')
const openFiles = (kind: 'config' | 'log') => { fileKind.value = kind; filesOpen.value = true }
onMounted(() => { void serviceController.refresh(); void startupGroupController.init() })
</script>

<style scoped>
.service-entry-actions { justify-content: flex-end; flex-wrap: wrap; }
</style>
