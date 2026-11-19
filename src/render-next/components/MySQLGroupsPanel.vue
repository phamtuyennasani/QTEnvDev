<template>
  <ForgeDialog wide title="MySQL instance groups" @close="emit('close')">
    <div class="detail-actions">
      <button class="action-button" :disabled="!mysql.all.length || busy" @click="mysqlGroupController.run('start')">Start / restart all</button>
      <button class="action-button" :disabled="!mysql.all.length || busy" @click="mysqlGroupController.run('stop')">Stop all</button>
      <button class="action-button" :disabled="!readyToEdit || busy" @click="edit()">Add instance group</button>
    </div>
    <p v-if="loading" role="status">Loading MySQL instance groups…</p>
    <p v-if="error" class="forge-alert forge-alert--error" role="alert">{{ error }}</p>
    <p v-if="mysql.inited && !mysql.all.length" class="empty-copy">No saved MySQL instance groups.</p>
    <article v-for="item in mysql.all" :key="item.id" class="mysql-group-row">
      <div class="mysql-group-heading">
        <b>{{ item.id }}</b>
        <code>MySQL {{ item.version.version }} · port {{ item.port }}</code>
        <span>{{ item.version.fetching ? 'Working…' : item.version.running === true ? 'Running' : item.version.running === false ? 'Stopped' : 'Status unknown' }}</span>
      </div>
      <button class="group-data-directory" type="button" @click="shell.showItemInFolder(item.dataDir)"><code>{{ item.dataDir }}</code></button>
      <div class="detail-actions">
        <button class="action-button" :disabled="busy" @click="mysqlGroupController.run('start', item)">{{ item.version.running ? 'Restart' : 'Start' }}</button>
        <button class="action-button" :disabled="busy || item.version.running === false" @click="mysqlGroupController.run('stop', item)">Stop</button>
        <button class="action-button" :disabled="!readyToEdit || busy" @click="edit(item)">Edit</button>
        <button class="action-button" @click="openConfig(item)">Configuration</button>
        <button class="action-button" @click="logItem = item">Logs</button>
        <button class="action-button" @click="copySocket(item)">Copy socket path</button>
        <button class="action-button action-button--danger" :disabled="busy" @click="removing = item">Remove</button>
      </div>
    </article>
  </ForgeDialog>
  <ForgeDialog v-if="form" :title="form.id ? 'Edit instance group' : 'Add instance group'" @close="closeForm">
    <form id="mysql-instance-group-form" class="group-form" @submit.prevent="save">
      <label>MySQL version
        <select v-model="form.bin" :disabled="catalogBusy" required>
          <option disabled value="">Select an installed version</option>
          <option v-for="version in installed" :key="version.bin" :value="version.bin">{{ version.version }} · {{ version.bin }}</option>
        </select>
      </label>
      <label>TCP port <input v-model="form.port" :disabled="catalogBusy" type="number" min="1" max="65535" required /></label>
      <label>Data directory <input v-model="form.dataDir" placeholder="Default managed directory" readonly /></label>
      <button class="action-button" type="button" :disabled="catalogBusy" @click="chooseDataDirectory">Choose folder</button>
    </form>
    <template #footer>
      <button class="action-button" :disabled="catalogBusy" @click="closeForm">Cancel</button>
      <button class="action-button action-button--primary" type="submit" form="mysql-instance-group-form" :disabled="catalogBusy">Save group</button>
    </template>
  </ForgeDialog>
  <ForgeDialog v-if="removing" title="Remove this instance group?" :description="removing.id" @close="closeRemove">
    <p>The group will stop and disappear from the list. Its data directory will be kept.</p>
    <template #footer>
      <button class="action-button" :disabled="catalogBusy" @click="closeRemove">Cancel</button>
      <button class="action-button action-button--danger" :disabled="catalogBusy" @click="remove">Remove group</button>
    </template>
  </ForgeDialog>
  <ServiceFilesDialog v-if="logItem" :model-value="true" :name="'MySQL group ' + logItem.id" kind="log" :owner="logController" :provider="groupLogs" @update:model-value="logItem = undefined" />
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { MysqlStore } from '@/components/Mysql/mysql'
  import { BrewStore } from '@/store/brew'
  import type { MysqlGroupItem } from '@shared/app'
  import { clipboard, dialog, shell } from '@/util/NodeFn'
  import { join } from '@/util/path-browserify'
  import { useAsyncComponentShow } from '@/util/AsyncComponent'
  import { uuid } from '@/util/Index'
  import ForgeDialog from './ForgeDialog.vue'
  import ServiceFilesDialog from './ServiceFilesDialog.vue'
  import type { ServiceFile } from '../state/serviceFilesController'
  import { mysqlGroupController } from '../state/mysqlGroupController'
  import { showNotice } from '../state/app'
  import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'

  const emit = defineEmits<{ close: [] }>()
  const mysql = MysqlStore()
  const versions = BrewStore().module('mysql')
  const { loading, catalogBusy, error, logs: logController } = mysqlGroupController
  const installed = computed(() => versions.installed)
  const readyToEdit = computed(() => mysql.inited && installed.value.length > 0)
  const busy = computed(() => loading.value || catalogBusy.value || mysql.all.some((item) => item.version.fetching))
  const managedPath = (file: string) => join(window.Server.MysqlDir!, 'group', file)
  const form = ref<{ id?: string; bin: string; port: number | string; dataDir: string }>()
  const removing = ref<MysqlGroupItem>()
  const logItem = ref<MysqlGroupItem>()
  provideLegacyToolContext({ poperFix: true, detachedClass: 'pqt-mysql-group-surface' })
  const openLegacy = useAsyncComponentShow()

  const edit = (item?: MysqlGroupItem) => {
    form.value = { id: item?.id, bin: item?.version.bin ?? '', port: item?.port ?? '', dataDir: item?.dataDir ?? '' }
  }
  const closeForm = () => { if (!catalogBusy.value) form.value = undefined }
  const closeRemove = () => { if (!catalogBusy.value) removing.value = undefined }
  const chooseDataDirectory = async () => {
    const target = form.value
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (target && target === form.value && !canceled && filePaths[0]) target.dataDir = filePaths[0]
  }
  const save = async () => {
    if (!form.value) return
    const { id: existingId, bin, port, dataDir } = form.value
    const version = installed.value.find((item) => item.bin === bin)
    if (!version || !Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) return
    const id = existingId || uuid(8).toUpperCase()
    const snapshot = { id, port: Number(port), version: JSON.parse(JSON.stringify(version)), dataDir: dataDir || managedPath('mysql-group-' + id) }
    if (await mysqlGroupController.change(snapshot)) closeForm()
  }
  const remove = async () => { if (removing.value && await mysqlGroupController.change(removing.value, true)) closeRemove() }
  const copySocket = (item: MysqlGroupItem) => {
    void clipboard.writeText(managedPath(`my-group-${item.id}.sock`)).then(() => showNotice('Socket path copied.'))
  }
  const openConfig = async (item: MysqlGroupItem) => {
    const { default: config } = await import('@/components/Mysql/Group/Config.vue')
    void openLegacy(config, { item })
  }
  const groupLogs = async (): Promise<ServiceFile[]> => {
    const id = logItem.value?.id
    if (!id || !/^[a-z0-9_-]+$/i.test(id)) throw new Error('Invalid MySQL instance group identifier.')
    return [
      { kind: 'log', name: 'Error log', path: managedPath(`my-group-${id}-error.log`) },
      { kind: 'log', name: 'Slow query log', path: managedPath(`my-group-${id}-slow.log`) }
    ]
  }

  onMounted(() => void mysqlGroupController.load())
</script>

<style scoped>
  .mysql-group-row { padding: 14px 0; border-top: 1px solid var(--pqt-border); }
  .mysql-group-heading { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
  .mysql-group-heading span { margin-left: auto; color: var(--pqt-text-muted); }
  .group-data-directory { padding: 6px 0; background: transparent; border: 0; text-align: left; cursor: pointer; }
  .group-form, .group-form label { display: grid; gap: 8px; }
  .group-form { gap: 12px; }
  .group-form input, .group-form select { padding: 8px; border: 1px solid var(--pqt-border); border-radius: 6px; background: var(--pqt-canvas); color: var(--pqt-text); }
  .group-form > button { justify-self: start; }
</style>
