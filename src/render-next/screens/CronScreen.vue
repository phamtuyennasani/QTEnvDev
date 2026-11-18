<template>
  <section class="screen">
    <header class="page-header"><div><p class="eyebrow">WORKSPACE / SCHEDULED TASKS</p><h1>Scheduled tasks</h1><p class="subtitle">Run and monitor local cron jobs.</p></div><div class="detail-actions"><button class="action-button action-button--primary" @click="editing=undefined;editorOpen=true">+ New task</button><button class="primary-button" @click="controller.load()">Refresh</button></div></header>
    <p v-if="controller.state.error" class="forge-alert forge-alert--error">{{ controller.state.error }}</p>
    <div class="panel cron-panel"><div v-if="!controller.state.jobs.length&&!controller.state.loading" class="empty-copy">No scheduled tasks configured.</div><div v-for="job in controller.state.jobs" :key="job.id" class="cron-row"><div class="cron-copy"><b>{{ job.name }}</b><small><code>{{ job.schedule }}</code> · {{ job.command }}</small><small>{{ job.enabled ? 'Enabled' : 'Disabled' }} · {{ job.scope === 'global' ? 'Global' : 'Website task' }}</small></div><div class="cron-actions"><button class="toggle" :class="{on:job.enabled}" @click="controller.toggle(job)"><i/></button><button class="action-button" @click="controller.run(job)">Run now</button><button class="action-button" @click="editing=job;editorOpen=true">Edit</button><button class="action-button action-button--danger" @click="pendingDelete=job">Delete</button></div></div></div>
    <ForgeDialog v-if="pendingDelete" title="Delete scheduled task?" :description="'This will remove ' + pendingDelete.name + '.'" @close="pendingDelete=undefined"><template #footer><button class="action-button" @click="pendingDelete=undefined">Cancel</button><button class="action-button action-button--danger" @click="confirmRemove">Delete task</button></template></ForgeDialog>
    <ForgeDialog v-if="editorOpen" :title="editing ? 'Edit task' : 'New task'" description="Use a portable five-field cron schedule." @close="editorOpen=false"><div class="cron-form"><label>Name<input v-model="form.name" /></label><label>Scope<select v-model="form.scope"><option value="global">Global</option><option value="host">Website</option></select></label><label v-if="form.scope==='host'">Website ID<input v-model.number="form.hostId" type="number" min="1" /></label><label>Schedule<input v-model="form.schedule" placeholder="* * * * *" /></label><label>Command<input v-model="form.command" /></label><label>Working directory<input v-model="form.workDir" /></label></div><template #footer><button class="action-button" @click="editorOpen=false">Cancel</button><button class="action-button action-button--primary" :disabled="!form.name||!form.schedule||!form.command" @click="save">Save task</button></template></ForgeDialog>
  </section>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import type { CronJob } from '@shared/app'
import { cronController } from '../state/cronController'
import ForgeDialog from '../components/ForgeDialog.vue'
const controller = cronController
const editorOpen = ref(false)
const editing = ref<CronJob>()
const pendingDelete = ref<CronJob>()
const form = reactive<{name:string;schedule:string;command:string;workDir:string;scope:'global'|'host';hostId?:number}>({ name:'', schedule:'', command:'', workDir:'', scope:'global' })
watch([editorOpen, editing], () => { if (editorOpen.value) { form.name=editing.value?.name??''; form.schedule=editing.value?.schedule??''; form.command=editing.value?.command??''; form.workDir=editing.value?.workDir??''; form.scope=editing.value?.scope??'global'; form.hostId=editing.value?.hostId } })
const save = async () => { if (await controller.save({...form}, editing.value)) editorOpen.value=false }
const confirmRemove = async () => { if (pendingDelete.value && await controller.remove(pendingDelete.value)) pendingDelete.value=undefined }
onMounted(() => void controller.load())
</script>
