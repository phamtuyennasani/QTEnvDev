<template>
  <section class="database-tools panel"><div class="panel-heading"><div><p class="eyebrow">DATABASE ACCESS</p><h3>Connection and data</h3><p class="website-help">Use module-reported credentials, ports and data paths. Missing values stay explicit.</p></div><button class="action-button" :disabled="controller.loading" @click="controller.load(name)">{{ controller.loading ? 'Loading…' : 'Refresh details' }}</button></div>
    <p v-if="controller.error" class="forge-alert forge-alert--error" role="alert">{{ controller.error }}</p>
    <div v-if="controller.connection" class="database-access-grid"><div><span>Host</span><code>{{ controller.connection.host }}</code></div><div><span>Port</span><code>{{ controller.connection.port || 'Not reported' }}</code></div><div><span>User</span><code>{{ controller.connection.user }}</code></div><div><span>Password</span><input v-model="password" type="password" :placeholder="controller.connection.password === '—' ? 'Not available' : 'Enter new password'" :disabled="!canChangePassword || controller.saving" /></div><div><span>Data directory</span><code>{{ controller.connection.dataDirectory || 'Not reported by module' }}</code></div></div>
    <div class="detail-actions"><button class="action-button" :disabled="!controller.connection?.dataDirectory" @click="controller.revealDataDirectory()">Reveal data directory</button><button v-if="canChangePassword" class="action-button action-button--primary" :disabled="!password || controller.saving" @click="changePassword">{{ controller.saving ? 'Updating…' : 'Change root password' }}</button></div>
    <div v-if="controller.databases.length" class="database-items"><b>Databases and users</b><div v-for="item in controller.databases" :key="item.name" class="database-item-row"><span>{{ item.name }}</span><small>{{ item.users.join(', ') || 'No users reported' }}</small></div></div>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { databaseToolsController as controller } from '../state/databaseToolsController'
const props = defineProps<{ name: string }>(); const name = computed(() => props.name); const password = ref(''); const canChangePassword = computed(() => props.name === 'MySQL' || props.name === 'MariaDB')
const changePassword = async () => { if (await controller.changePassword(password.value)) password.value = '' }
onMounted(() => { void controller.load(name.value) }); watch(name, (value) => { password.value = ''; void controller.load(value) })
</script>
