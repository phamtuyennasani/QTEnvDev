<template>
  <section class="screen">
    <header class="page-header"><div><p class="eyebrow">WORKSPACE / DATABASES</p><h1>Databases</h1><p class="subtitle">Installed database versions and native service controls.</p></div><button class="primary-button" @click="packageBrowser?.show()">＋ Add database</button></header>
    <div class="database-layout">
      <article class="panel database-list-panel"><div class="list-heading database-heading"><span>Database</span><span>Port</span><span>Version</span><span>Status</span></div><button v-for="database in databaseController.databases" :key="database.name" class="database-item" :class="{ selected: selectedDatabase?.name === database.name }" @click="databaseController.select(database)"><span class="database-primary"><span class="database-mark">◈</span><span><b>{{ database.name }}</b><small>{{ database.engine }}</small></span></span><code>{{ database.port ?? 'Not reported' }}</code><code>{{ database.version }}</code><span class="state-label" :class="'state-label--' + database.state">{{ database.state }}</span></button></article>
      <article v-if="selectedDatabase" class="panel database-detail-panel">
        <div class="detail-top"><div><p class="eyebrow">DATABASE DETAIL</p><h2>{{ selectedDatabase.name }}</h2><p class="detail-kind">{{ selectedDatabase.engine }} · <code>{{ selectedDatabase.version }}</code></p></div><i class="large-status-dot" :class="'status-dot--' + selectedDatabase.state"></i></div>
        <div class="detail-status"><span class="status-dot" :class="'status-dot--' + selectedDatabase.state"></span><b>{{ busy ? 'Working…' : selectedDatabase.state }}</b></div>
        <div class="database-facts"><div><span>Endpoint</span><code>{{ selectedDatabase.port ? 'localhost:' + selectedDatabase.port : 'Not reported' }}</code></div><div><span>Connections / storage</span><b>Not measured</b></div></div>
        <div class="detail-actions"><button class="action-button action-button--primary" :disabled="busy || !service || selectedDatabase.version === '—'" @click="run(selectedDatabase.state === 'running' ? 'Restart' : 'Start')">{{ selectedDatabase.state === 'running' ? 'Restart' : 'Start' }}</button><button class="action-button" :disabled="busy || selectedDatabase.state !== 'running'" @click="run('Stop')">Stop</button></div>
        <div class="detail-actions"><button class="action-button" @click="openFiles('config')">Configuration</button><button class="action-button" @click="openFiles('log')">Logs</button><button v-for="tool in adminTools" :key="tool.id" class="action-button" :disabled="adminController.isOpening(tool.id)" @click="adminController.open(tool.id)">{{ adminController.isOpening(tool.id) ? 'Opening…' : tool.label }}</button></div>
        <DatabaseToolsPanel :name="selectedDatabase.name" />
        <PackageBrowser v-if="selectedFlag" ref="packageBrowser" :key="selectedFlag" :flag="selectedFlag" :title="selectedDatabase.name" />
      </article>
    </div>
    <ServiceFilesDialog v-if="selectedDatabase" v-model="filesOpen" :name="selectedDatabase.name" :version="selectedDatabase.version" :kind="fileKind" />
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { databaseController } from '../state/databaseController'
import { serviceController } from '../state/serviceController'
import PackageBrowser from '../components/PackageBrowser.vue'
import ServiceFilesDialog from '../components/ServiceFilesDialog.vue'
import { databaseAdminController } from '../state/databaseAdminController'
import DatabaseToolsPanel from '../components/DatabaseToolsPanel.vue'
const packageBrowser = ref<InstanceType<typeof PackageBrowser>>()
const selectedDatabase = computed(() => databaseController.selected.database)
const flags: Record<string, string> = { MySQL: 'mysql', MariaDB: 'mariadb', PostgreSQL: 'postgresql', Redis: 'redis', MongoDB: 'mongodb', ClickHouse: 'clickhouse', Neo4j: 'neo4j', Elasticsearch: 'elasticsearch', Qdrant: 'qdrant' }
const selectedFlag = computed(() => selectedDatabase.value ? flags[selectedDatabase.value.name] : undefined)
const service = computed(() => serviceController.services.find((item) => item.name === selectedDatabase.value?.name))
const busy = computed(() => service.value?.state === 'busy')
const filesOpen = ref(false); const fileKind = ref<'config' | 'log'>('log')
const openFiles = (kind: 'config' | 'log') => { fileKind.value = kind; filesOpen.value = true }
const adminController = databaseAdminController
const adminTools = computed(() => selectedDatabase.value ? adminController.actions.filter((tool) => tool.database === selectedDatabase.value?.name) : [])
const run = async (action: 'Start' | 'Stop' | 'Restart') => { if (service.value) { await serviceController.run(service.value, action); await databaseController.refresh() } }
onMounted(() => { void databaseController.refresh() })
</script>
