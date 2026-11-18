<template>
  <section class="screen services-screen">
    <header class="page-header"><div><p class="eyebrow">WORKSPACE / SERVICES</p><h1>Services</h1><p class="subtitle">Control the processes that power your local stack.</p></div><button class="primary-button" @click="startGroup"><span class="button-glyph">▶</span> Start group</button></header>
    <div class="service-toolbar"><label class="search-box"><span>⌕</span><input v-model="query" placeholder="Filter services" /></label><div class="filter-tabs"><button v-for="tab in tabs" :key="tab" :class="{ active: filter === tab }" @click="filter = tab">{{ tab }}</button></div></div>
    <div class="services-layout"><article class="panel services-list-panel"><div class="list-heading"><span>Service</span><span>Version</span><span>Port</span><span>Status</span></div><button v-for="service in filteredServices" :key="service.name" class="service-item" :class="{ selected: selectedService?.name === service.name }" @click="serviceController.select(service)"><span class="service-primary"><i class="status-dot" :class="`status-dot--${service.state}`"></i><span><b>{{ service.name }}</b><small>{{ service.kind }}</small></span></span><code>{{ service.version }}</code><code>:{{ service.port }}</code><span class="state-label" :class="`state-label--${service.state}`">{{ formatState(service.state) }}</span></button><p v-if="filteredServices.length === 0" class="empty-copy">No services match this filter.</p></article><article v-if="selectedService" class="panel service-detail-panel"><div class="detail-top"><div><p class="eyebrow">SERVICE DETAIL</p><h2>{{ selectedService.name }}</h2><p class="detail-kind">{{ selectedService.kind }} · <code>{{ selectedService.version }}</code></p></div><i class="large-status-dot" :class="`status-dot--${selectedService.state}`"></i></div><div class="detail-status"><span class="status-dot" :class="`status-dot--${selectedService.state}`"></span><b>{{ formatState(selectedService.state) }}</b><span v-if="selectedService.state === 'running'" class="uptime">{{ selectedService.uptime }} uptime</span></div><div class="detail-facts"><div><span>Endpoint</span><code>localhost:{{ selectedService.port }}</code></div><div><span>Process</span><code>{{ selectedService.state === 'running' ? 'Healthy' : 'Offline' }}</code></div></div><div class="detail-actions"><button class="action-button action-button--primary" :disabled="selectedService.state === 'busy'" @click="serviceController.run(selectedService, selectedService.state === 'running' ? 'Restart' : 'Start')">{{ selectedService.state === 'running' ? 'Restart' : 'Start' }}</button><button class="action-button" :disabled="selectedService.state !== 'running'" @click="serviceController.run(selectedService, 'Stop')">Stop</button></div><div class="detail-actions"><button class="action-button" @click="openFiles('config')">Configuration</button><button class="action-button" @click="openFiles('log')">Logs</button></div><PackageBrowser v-if="selectedFlag" :key="selectedFlag" :flag="selectedFlag" :title="selectedService.name" /></article></div><ServiceFilesDialog v-model="filesOpen" :name="selectedService.name" :version="selectedService.version" :kind="fileKind" />
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { serviceController, type ServiceState } from '../state/serviceController'
import { showNotice } from '../state/app'
import PackageBrowser from '../components/PackageBrowser.vue'
import ServiceFilesDialog from '../components/ServiceFilesDialog.vue'
import { packageFlagForName } from '../packages/catalog'
import { startupGroupController } from '../state/startupGroupController'
const query = ref(''); const filter = ref('All'); const tabs = ['All', 'Running', 'Stopped']
const selectedService = computed(() => serviceController.selected.service!)
const filteredServices = computed(() => serviceController.services.filter((service) => { const textMatch = `${service.name} ${service.kind}`.toLowerCase().includes(query.value.toLowerCase()); const stateMatch = filter.value === 'All' || (filter.value === 'Running' ? service.state === 'running' : service.state === 'stopped'); return textMatch && stateMatch }))
const formatState = (state: ServiceState) => state === 'busy' ? 'Working…' : state[0].toUpperCase() + state.slice(1)
const notify = (message: string) => showNotice(message)
const startGroup = async () => { if (startupGroupController.defaultGroup.value) { await startupGroupController.runDefault(); return } const result = await serviceController.runGroup(); notify(result.completed + ' services started; ' + result.failed + ' failed') }
const selectedFlag = computed(() => selectedService.value ? packageFlagForName(selectedService.value.name) : undefined)
const filesOpen = ref(false); const fileKind = ref<'config' | 'log'>('log')
const openFiles = (kind: 'config' | 'log') => { fileKind.value = kind; filesOpen.value = true }
onMounted(() => { void serviceController.refresh(); void startupGroupController.init() })
</script>
