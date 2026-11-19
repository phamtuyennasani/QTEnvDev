<template>
  <section class="screen">
    <header class="page-header"><div><p class="eyebrow">WORKSPACE / DATABASES</p><h1>Databases</h1><p class="subtitle">Installed database versions and native service controls.</p></div><button v-if="selectedDatabase" class="primary-button" @click="packageBrowser?.show()">＋ Add database</button></header>
    <div class="database-layout">
      <article class="panel database-list-panel">
        <div class="list-heading database-heading"><span>Database</span><span>Version</span><span>Status</span></div>
        <button
          v-for="database in visibleDatabases"
          :key="database.name"
          class="database-item"
          :class="{ selected: selectedDatabase?.name === database.name }"
          @click="databaseController.select(database)"
        >
          <span class="database-primary">
            <span class="database-mark">◈</span>
            <span><b>{{ database.name }}</b><small>{{ database.engine }}</small></span>
          </span>
          <code>{{ database.version }}</code>
          <span class="state-label" :class="'state-label--' + database.state">{{ database.state }}</span>
        </button>
        <p v-if="!visibleDatabases.length" class="empty-copy">No visible database modules.</p>
      </article>
      <article v-if="selectedDatabase" class="panel database-detail-panel">
        <div class="detail-top"><div><p class="eyebrow">DATABASE DETAIL</p><h2>{{ selectedDatabase.name }}</h2><p class="detail-kind">{{ selectedDatabase.engine }} · <code>{{ selectedDatabase.version }}</code></p></div><i class="large-status-dot" :class="'status-dot--' + selectedDatabase.state"></i></div>
        <div class="detail-status"><span class="status-dot" :class="'status-dot--' + selectedDatabase.state"></span><b>{{ busy ? 'Working…' : selectedDatabase.state }}</b></div>
        <div v-if="connection?.port" class="database-facts">
          <div>
            <span>{{ connection.host === '—' ? 'Configured port' : 'Configured endpoint' }}</span>
            <code>{{ connection.host === '—' ? connection.port : `${connection.host}:${connection.port}` }}</code>
          </div>
        </div>
        <div class="detail-actions"><button class="action-button action-button--primary" :disabled="busy || !service || selectedDatabase.version === '—'" @click="run(selectedDatabase.state === 'running' ? 'Restart' : 'Start')">{{ selectedDatabase.state === 'running' ? 'Restart' : 'Start' }}</button><button class="action-button" :disabled="busy || selectedDatabase.state !== 'running'" @click="run('Stop')">Stop</button></div>
        <div class="detail-actions"><button class="action-button" @click="openFiles('config')">Configuration</button><button class="action-button" @click="openFiles('log')">Logs</button><button v-if="manageEngine" class="action-button" @click="openFiles('log', 'slow')">Slow query log</button><button v-for="tool in adminTools" :key="tool.id" class="action-button" :disabled="adminController.isOpening(tool.id)" @click="adminController.open(tool.id, manageEngine)">{{ adminController.isOpening(tool.id) ? 'Opening…' : tool.label }}</button></div>
        <p v-if="manageEngine && adminController.phpMyAdminStatus.progress !== undefined" class="website-help" role="status">Setting up phpMyAdmin ({{ adminController.phpMyAdminStatus.progress }}%)</p>
        <p v-else-if="manageEngine && adminController.phpMyAdminStatus.message" class="website-help" role="status">{{ adminController.phpMyAdminStatus.message }}</p>
        <button v-if="manageEngine" class="action-button" :disabled="busy || opening || Boolean(active) || selectedDatabase.version === '—'" @click="databaseManageController.open(manageEngine)">{{ opening ? 'Opening…' : 'Manage databases' }}</button>
        <button v-if="manageEngine === 'mysql'" class="action-button" :disabled="!groupsAvailable" @click="groupsOpen = true">MySQL instance groups</button>
        <button v-if="selectedFlag" class="action-button" @click="versionsOpen = true">Installed versions</button>
        <PostgreSqlDataDirectory v-if="selectedFlag === 'postgresql'" />
        <DatabaseToolsPanel :name="selectedDatabase.name" />
        <PackageBrowser v-if="selectedFlag" ref="packageBrowser" :key="selectedFlag" :flag="selectedFlag" :title="selectedDatabase.name" />
      </article>
    </div>
    <ServiceFilesDialog
      v-if="selectedDatabase"
      v-model="filesOpen"
      :name="selectedDatabase.name"
      :version="selectedVersion"
      :kind="fileKind"
      :only-file="onlyFile"
      :provider="redisConfiguration ? loadRedisConfiguration : undefined"
    >
      <template v-if="redisConfiguration" #configuration="{ content, readOnly, update }">
        <RedisCommonConfiguration :content="content" :read-only="readOnly" @update="update" />
      </template>
    </ServiceFilesDialog>
    <MySQLGroupsPanel v-if="groupsOpen" @close="groupsOpen = false" />
    <InstalledVersionsDialog
      v-if="versionsOpen && selectedFlag && selectedDatabase"
      :key="selectedFlag"
      :flag="selectedFlag"
      :title="selectedDatabase.name"
      @close="closeVersions"
    />
  </section>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { databaseController } from '../state/databaseController'
import { databaseModuleFlags, databaseVersion } from '../adapters/databaseAdapter'
import { serviceController } from '../state/serviceController'
import PackageBrowser from '../components/PackageBrowser.vue'
import ServiceFilesDialog from '../components/ServiceFilesDialog.vue'
import { databaseAdminController } from '../state/databaseAdminController'
import DatabaseToolsPanel from '../components/DatabaseToolsPanel.vue'
import { databaseManageController } from '../state/databaseManageController'
import { databaseToolsController } from '../state/databaseToolsController'
import RedisCommonConfiguration from '../redis/CommonConfiguration.vue'
import { redisConfigurationFiles } from '../redis/configuration'
const packageBrowser = ref<InstanceType<typeof PackageBrowser>>()
const visibleDatabases = databaseController.visibleDatabases
const selectedDatabase = computed(() => {
  const databases = visibleDatabases.value
  return databases.find((database) => database === databaseController.selected.database) ?? databases[0]
})
const selectedFlag = computed(() => selectedDatabase.value ? databaseModuleFlags[selectedDatabase.value.name] : undefined)
const selectedVersion = computed(() => selectedDatabase.value ? databaseVersion(selectedDatabase.value.name) : undefined)
const connection = computed(() => databaseToolsController.connection?.name === selectedDatabase.value?.name ? databaseToolsController.connection : undefined)
const manageEngine = computed(() => selectedFlag.value === 'mysql' ? 'mysql' : selectedFlag.value === 'mariadb' ? 'mariadb' : undefined)
const { active, opening } = databaseManageController
const service = computed(() => serviceController.services.find((item) => item.name === selectedDatabase.value?.name))
const busy = computed(() => service.value?.state === 'busy')
const MySQLGroupsPanel = defineAsyncComponent(() => import('../components/MySQLGroupsPanel.vue'))
const PostgreSqlDataDirectory = defineAsyncComponent(() => import('@/components/PostgreSql/DataDirectoryControls.vue'))
const InstalledVersionsDialog = defineAsyncComponent(() => import('../serviceVersions/InstalledVersionsDialog.vue'))
const groupsAvailable = computed(() => Boolean(window.QTEnvDevNodeAPI && window.Server?.DataDirectoryReady && window.Server.MysqlDir))
const groupsOpen = ref(false)
const versionsOpen = ref(false)
const closeVersions = () => { versionsOpen.value = false; void databaseController.refresh() }
const filesOpen = ref(false); const fileKind = ref<'config' | 'log'>('log')
const redisConfiguration = computed(() => selectedFlag.value === 'redis' && fileKind.value === 'config')
const loadRedisConfiguration = () => redisConfigurationFiles(selectedVersion.value?.version ?? '')
const onlyFile = ref<string>()
const openFiles = (kind: 'config' | 'log', file?: string) => { fileKind.value = kind; onlyFile.value = file; filesOpen.value = true }
const adminController = databaseAdminController
const adminTools = computed(() => {
  const database = selectedDatabase.value
  return database?.state === 'running'
    ? adminController.actions.filter((tool) => tool.database === database.name)
    : []
})
const run = async (action: 'Start' | 'Stop' | 'Restart') => { if (service.value) { await serviceController.run(service.value, action); await databaseController.refresh() } }
onMounted(() => { void databaseController.refresh() })
</script>

<style scoped>
.database-heading,
.database-item {
  grid-template-columns: minmax(0, 1.5fr) minmax(0, .7fr) minmax(0, .8fr);
}
</style>
