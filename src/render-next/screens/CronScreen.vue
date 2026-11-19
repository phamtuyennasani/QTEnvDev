<template>
  <section class="screen">
    <header class="page-header">
      <div>
        <p class="eyebrow">WORKSPACE / SCHEDULED TASKS</p>
        <h1>Scheduled tasks</h1>
        <p class="subtitle">Run and monitor local cron jobs.</p>
      </div>
      <div class="detail-actions">
        <button v-if="tab === 'app'" class="action-button action-button--primary" :disabled="blocked" @click="openEditor()">
          + New task
        </button>
        <button v-if="tab === 'app'" class="primary-button" :disabled="controller.state.loading || controller.state.busy" @click="controller.load()">
          Refresh
        </button>
      </div>
    </header>
    <div class="detail-actions cron-tabs" role="tablist" aria-label="Task source">
      <button class="action-button" role="tab" :aria-selected="tab === 'app'" @click="tab = 'app'">App tasks</button>
      <button class="action-button" role="tab" :aria-selected="tab === 'system'" @click="tab = 'system'">System scheduler</button>
    </div>
    <CronSystemTasks v-if="tab === 'system'" />
    <template v-else>
    <div v-if="website" class="detail-actions">
      <span>Website: {{ website.name }}</span>
      <button class="text-button" @click="navigateNext('cron')">Show all tasks</button>
    </div>
    <p v-if="controller.state.unknown" class="forge-alert forge-alert--error" role="alert">
      A scheduler operation has an unknown result. Check the task before reopening the app to retry.
    </p>
    <p v-if="controller.state.error && !editorOpen && !pendingDelete" class="forge-alert forge-alert--error" role="alert">
      {{ controller.state.error }}
    </p>
    <div class="panel cron-panel" :aria-busy="controller.state.loading || controller.state.busy">
      <div v-if="!jobs.length && !controller.state.loading && !controller.state.error" class="empty-copy">
        No scheduled tasks configured.
      </div>
      <div v-for="job in jobs" :key="controller.taskKey(job)" class="cron-row">
        <div class="cron-copy">
          <b>{{ job.name }}</b>
          <small><code>{{ job.schedule }}</code> · {{ job.command }}</small>
          <small>{{ job.enabled ? 'Enabled' : 'Disabled' }} · {{ job.scope === 'host' ? 'Website task' : 'Global' }}</small>
          <p v-if="job.systemError && !controller.outcome(job)" class="cron-result" role="status">
            Schedule registration failed. {{ job.systemError }}
          </p>
          <p v-if="controller.outcome(job)" class="cron-result" role="status">
            {{ controller.outcome(job)?.message }}
          </p>
          <details v-if="controller.outcome(job)?.command || typeof job.lastExitCode === 'number'">
            <summary>Last run output</summary>
            <pre>{{ runOutput(job) }}</pre>
          </details>
        </div>
        <div class="cron-actions">
          <button
            class="toggle"
            :class="{ on: job.enabled }"
            :aria-label="job.enabled ? 'Disable task' : 'Enable task'"
            :aria-pressed="job.enabled"
            :disabled="blocked"
            @click="controller.toggle(job)"
          ><i /></button>
          <button class="action-button" :disabled="blocked" @click="controller.run(job)">Run now</button>
          <button class="action-button" @click="openHistory(job)">Run history</button>
          <button class="action-button" :disabled="blocked" @click="openEditor(job)">Edit</button>
          <button class="action-button action-button--danger" :disabled="blocked" @click="openDelete(job)">Delete</button>
        </div>
      </div>
    </div>
    <ForgeDialog
      v-if="pendingDelete"
      title="Delete scheduled task?"
      :description="'This will remove ' + pendingDelete.name + '.'"
      @close="pendingDelete = undefined"
    >
      <p v-if="controller.state.error" class="forge-alert forge-alert--error" role="alert">{{ controller.state.error }}</p>
      <template #footer>
        <button class="action-button" @click="pendingDelete = undefined">Cancel</button>
        <button class="action-button action-button--danger" :disabled="blocked" @click="confirmRemove">Delete task</button>
      </template>
    </ForgeDialog>
    <ForgeDialog v-if="historyJob" :title="'Run history: ' + historyJob.name" description="The most recent 20 recorded runs." wide @close="historyJob = undefined">
      <button class="action-button" :disabled="history?.loading" @click="controller.loadHistory(historyJob)">Refresh history</button>
      <p v-if="history?.loading">Loading run history…</p>
      <p v-if="history?.error" class="forge-alert forge-alert--error" role="alert">{{ history.error }}</p>
      <p v-if="!history?.loading && !history?.error && !history?.records.length">No recorded runs.</p>
      <article v-for="record in history?.records" :key="record.id" class="cron-history-record">
        <b>Exit {{ record.exitCode }} · {{ new Date(record.finishedAt).toLocaleString() }}</b>
        <small>{{ record.duration }} ms</small>
        <pre>{{ [record.output, record.error].filter(Boolean).join('\n') || '(No output)' }}</pre>
      </article>
    </ForgeDialog>
    </template>
    <ForgeDialog
      v-if="editorOpen"
      :title="editing ? 'Edit task' : 'New task'"
      description="Use a portable five-field cron schedule."
      @close="editorOpen = false"
    >
      <div class="cron-form">
        <label>Name<input v-model="form.name" /></label>
        <label>Scope<select v-model="form.scope"><option value="global">Global</option><option value="host">Website</option></select></label>
        <label v-if="form.scope === 'host'">
          Website
          <select v-model.number="form.hostId">
            <option :value="undefined">Choose a website</option>
            <option v-if="missingHost" :value="form.hostId">Unavailable website ({{ form.hostId }})</option>
            <option v-for="host in hosts" :key="host.id" :value="host.id">{{ host.name }}</option>
          </select>
        </label>
        <label>Schedule<input v-model="form.schedule" placeholder="* * * * *" /></label>
        <label>Command<input v-model="form.command" /></label>
        <label>Working directory<input v-model="form.workDir" /></label>
      </div>
      <p v-if="controller.state.error" class="forge-alert forge-alert--error" role="alert">{{ controller.state.error }}</p>
      <template #footer>
        <button class="action-button" @click="editorOpen = false">Cancel</button>
        <button
          class="action-button action-button--primary"
          :disabled="blocked || !form.name || !form.schedule || !form.command || (form.scope === 'host' && (!form.hostId || missingHost))"
          @click="save"
        >Save task</button>
      </template>
    </ForgeDialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { CronJob } from '@shared/app'
import { cronController as controller } from '../state/cronController'
import { navigateNext, nextAppState } from '../state/app'
import { projectController } from '../state/projectController'
import ForgeDialog from '../components/ForgeDialog.vue'
import CronSystemTasks from '../components/CronSystemTasks.vue'

const hosts = computed(() => projectController.projects.map((project) => project.host))
const website = computed(() => nextAppState.cronWebsite)
const jobs = computed(() => website.value
  ? controller.state.jobs.filter((job) => job.hostId === website.value?.id)
  : controller.state.jobs)
const editorOpen = ref(false)
const tab = ref('app')
const historyJob = ref<CronJob>()
const history = computed(() => historyJob.value ? controller.historyFor(historyJob.value) : undefined)
const openHistory = (job: CronJob) => {
  historyJob.value = job
  void controller.loadHistory(job)
}
const editing = ref<CronJob>()
const pendingDelete = ref<CronJob>()
const form = reactive<{
  name: string
  schedule: string
  command: string
  workDir: string
  scope: 'global' | 'host'
  hostId?: number
}>({ name: '', schedule: '', command: '', workDir: '', scope: 'global' })
const blocked = computed(() => controller.state.busy || controller.state.unknown || controller.state.loading || controller.system.loading)
const missingHost = computed(() => !!form.hostId && !hosts.value.some((host) => host.id === form.hostId))

const openEditor = (job?: CronJob) => {
  controller.clearError()
  editing.value = job
  form.name = job?.name ?? ''
  form.schedule = job?.schedule ?? ''
  form.command = job?.command ?? ''
  form.workDir = job ? job.workDir ?? '' : website.value?.root ?? ''
  form.hostId = job ? job.hostId : website.value?.id
  form.scope = job?.scope ?? (form.hostId ? 'host' : 'global')
  editorOpen.value = true
}
const openDelete = (job: CronJob) => {
  controller.clearError()
  pendingDelete.value = job
}
const runOutput = (job: CronJob) => {
  const result = controller.outcome(job)?.command
  const exitCode = result?.exitCode ?? job.lastExitCode
  return ['Exit code ' + exitCode, result?.output ?? job.lastOutput, result?.error ?? job.lastError]
    .filter(Boolean)
    .join('\n')
}
const save = async () => {
  if (await controller.save({ ...form }, editing.value)) editorOpen.value = false
}
const confirmRemove = async () => {
  if (pendingDelete.value && await controller.remove(pendingDelete.value)) pendingDelete.value = undefined
}
onMounted(() => {
  if (!controller.state.busy) void controller.load()
  void projectController.refresh()
})
</script>

<style scoped>
.cron-result { font-size: 12px; overflow-wrap: anywhere; }
.cron-copy details { font-size: 12px; }
.cron-copy pre { max-height: 180px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
.cron-tabs { margin-bottom: 12px; }
.cron-tabs [aria-selected=true] { border-color: var(--pqt-accent); }
.cron-history-record { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--pqt-border); }
.cron-history-record small { display: block; margin-top: 5px; }
.cron-history-record pre { max-height: 180px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
