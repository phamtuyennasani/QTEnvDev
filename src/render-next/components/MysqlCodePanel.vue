<template>
  <ForgeDialog title="MySQL code maker" description="Connect to a MySQL server and inspect its available databases." eyebrow="WORKSPACE / DATABASES" @close="emit('close')">
    <div class="mysql-panel"><fieldset class="mysql-grid" :disabled="controller.operation.running"><label>User<input v-model="form.user" /></label><label>Password<input v-model="form.password" type="password" /></label><label>Host<input v-model="form.host" /></label><label>Port<input v-model.number="form.port" type="number" min="1" max="65535" /></label></fieldset><button class="primary-button" :disabled="controller.operation.running" @click="controller.connect(form)">{{ controller.operation.running ? 'Connecting…' : 'Connect' }}</button><p v-if="controller.operation.error" class="forge-alert forge-alert--error">{{ controller.operation.error }}</p><p v-if="controller.operation.warning" class="forge-alert">{{ controller.operation.warning }}</p><div v-if="controller.databases.length" class="db-list"><b>Databases</b><code v-for="database in controller.databases" :key="database">{{ database }}</code></div><p v-else class="empty-copy">Connect to load databases.</p></div>
  </ForgeDialog>
</template>
<script setup lang="ts">
import { reactive } from 'vue'
import ForgeDialog from './ForgeDialog.vue'
import { mysqlCodeController as controller } from '../state/mysqlCodeController'
const emit = defineEmits<{ close: [] }>()
const form = reactive({ user: 'root', password: '', host: '127.0.0.1', port: 3306 })
</script>
<style scoped>
.mysql-panel{display:grid;gap:14px}.mysql-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;border:0;padding:0;margin:0}.mysql-grid label{display:grid;gap:6px;color:var(--pqt-text-muted);font-size:11px}.mysql-grid input{padding:9px;color:var(--pqt-text);background:var(--pqt-canvas);border:1px solid var(--pqt-border-strong);border-radius:7px;font:12px var(--pqt-font-mono)}.db-list{display:grid;gap:6px;padding:12px;border:1px solid var(--pqt-border);border-radius:7px}.db-list code{padding:7px;background:var(--pqt-canvas);color:var(--pqt-text-muted);font:11px var(--pqt-font-mono)}
</style>
