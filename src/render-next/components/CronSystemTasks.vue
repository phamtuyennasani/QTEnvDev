<template>
  <section class="panel cron-system-panel">
    <div class="detail-actions">
      <input v-model="query" class="search-box" aria-label="Filter system tasks" placeholder="Filter system tasks" />
      <select v-model="source" aria-label="System task source">
        <option value="all">All tasks</option>
        <option value="app">PQT Forge</option>
        <option value="other">Other system tasks</option>
      </select>
      <button class="action-button" :disabled="system.loading || controller.state.busy" @click="controller.loadSystem()">Refresh</button>
    </div>
    <p v-if="system.error" class="forge-alert forge-alert--error" role="alert">{{ system.error }}</p>
    <p v-if="controller.state.unknown" class="forge-alert forge-alert--error" role="alert">A scheduler operation has an unknown result. Check the task before reopening the app to retry.</p>
    <p v-else-if="tasks.length && !system.verified && !system.loading" class="empty-copy">Refresh the list before deleting a system task.</p>
    <p v-if="system.result" role="status">{{ system.result }}</p>
    <p v-if="system.loading" class="empty-copy">Reading the system scheduler…</p>
    <p v-else-if="!tasks.length && system.verified" class="empty-copy">No matching system tasks.</p>
    <article v-for="task in tasks" :key="task.id" class="cron-row">
      <div class="cron-copy">
        <b>{{ task.isQTEnvDev ? task.name || task.fullName : task.fullName || task.name }}</b>
        <small>{{ task.isQTEnvDev ? 'PQT Forge' : 'System task' }} · {{ task.state || (task.enabled === false ? 'Disabled' : 'Enabled') }}</small>
        <small><code>{{ task.schedule || 'No schedule reported' }}</code></small>
        <small v-if="task.nextRunTime">Next run: {{ new Date(task.nextRunTime).toLocaleString() }}</small>
        <details>
          <summary>Command and details</summary>
          <pre>{{ [task.command, task.description, task.author].filter(Boolean).join('\n') || 'No command reported.' }}</pre>
        </details>
      </div>
      <button class="action-button action-button--danger" :disabled="blocked" @click="pending = task">Delete</button>
    </article>
    <ForgeDialog v-if="pending" title="Delete system task?" :description="pending.fullName || pending.name" @close="pending = undefined">
      <p>This removes the selected entry from the operating system scheduler.</p>
      <p v-if="system.error" class="forge-alert forge-alert--error" role="alert">{{ system.error }}</p>
      <p v-else-if="!controller.state.busy && !controller.isCurrentSystemTask(pending)" role="status">The task list changed. Close this dialog and select the task again from a refreshed list.</p>
      <template #footer>
        <button class="action-button" @click="pending = undefined">Cancel</button>
        <button class="action-button action-button--danger" :disabled="blocked || !controller.isCurrentSystemTask(pending)" @click="confirmRemove">Delete system task</button>
      </template>
    </ForgeDialog>
  </section>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import type { SystemScheduledTask } from '@shared/app'
  import { cronController as controller } from '../state/cronController'
  import ForgeDialog from './ForgeDialog.vue'

  const system = controller.system
  const query = ref('')
  const source = ref('all')
  const pending = ref<SystemScheduledTask>()
  const blocked = computed(() => controller.state.busy || controller.state.loading || controller.state.unknown || system.loading || !system.verified)
  const tasks = computed(() => system.tasks.filter((task) => {
    const content = [task.name, task.fullName, task.path, task.schedule, task.command, task.description, task.author].filter(Boolean).join(' ').toLowerCase()
    return (source.value === 'all' || (source.value === 'app' ? task.isQTEnvDev : !task.isQTEnvDev)) && content.includes(query.value.trim().toLowerCase())
  }))
  const confirmRemove = async () => {
    if (pending.value && await controller.removeSystem(pending.value)) pending.value = undefined
  }
  onMounted(() => void controller.loadSystem())
</script>

<style scoped>
  .cron-system-panel { padding: 16px; }
  .detail-actions { margin-bottom: 12px; }
  input, select { padding: 7px; border: 1px solid var(--pqt-border); border-radius: 6px; background: var(--pqt-field); color: var(--pqt-text); }
  .cron-copy { min-width: 0; overflow-wrap: anywhere; }
  details { margin-top: 8px; }
  pre { max-height: 160px; overflow: auto; white-space: pre-wrap; }
</style>
