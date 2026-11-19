<template>
  <section class="project-workflows panel">
    <div class="panel-heading"><div><h2>Language projects</h2></div><div class="detail-actions"><button class="action-button" :disabled="controller.loading || controller.busy" @click="controller.load()">{{ controller.loading ? 'Refreshing…' : 'Refresh' }}</button><button class="action-button action-button--primary" :disabled="controller.busy || !firstLanguage" @click="managedLanguage = firstLanguage">Manage projects</button></div></div>
    <p v-if="controller.error" class="forge-alert forge-alert--error" role="alert">{{ controller.error }}</p>
    <div v-if="!controller.projects.length && !controller.loading && !controller.error" class="empty-copy">No saved language projects.</div>
    <div v-for="project in controller.projects" :key="project.id" class="workflow-row">
      <div class="workflow-main"><span class="project-icon">⌘</span><span><b>{{ project.item.comment || project.item.path }}</b><small>{{ workflowLabels[project.kind] }} · {{ project.item.path }}</small><small v-if="project.item.runCommand || project.item.runFile" class="workflow-command">{{ project.item.runCommand || project.item.runFile }}</small></span></div>
      <div class="workflow-facts"><code v-if="controller.projectUrl(project)">{{ controller.projectUrl(project) }}</code><span v-if="project.item.isService" :class="['workflow-state', project.item.state.isRun ? 'is-running' : '']">{{ project.item.state.running ? 'Working…' : project.item.state.isRun ? 'Running' : 'Stopped' }}</span></div>
      <div class="workflow-actions"><button class="text-button" @click="controller.open(project.item.path)">Open folder ↗</button><button class="text-button" :disabled="!project.item.configPath?.length" @click="controller.revealFile(project, 'config')">Config ↗</button><button class="text-button" :disabled="!project.item.logPath?.length" @click="controller.revealFile(project, 'log')">Logs ↗</button><button v-if="project.item.state.isRun" class="action-button action-button--danger" :disabled="controller.busy || project.item.state.running" @click="controller.run(project, 'stop')">Stop</button><button v-else-if="project.item.isService" class="action-button action-button--primary" :disabled="controller.busy || project.item.state.running" @click="controller.run(project, 'start')">Start</button></div>
    </div>
    <LanguageProjectManager v-if="managedLanguage" :initial-language="managedLanguage" @close="managedLanguage = undefined" @scaffold-website="openScaffoldWebsite" />
  </section>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { projectWorkflowController as controller, visibleWorkflowKinds, workflowLabels, type WorkflowKind } from '../state/projectWorkflowController'
const LanguageProjectManager = defineAsyncComponent(() => import('./LanguageProjectManager.vue'))
const managedLanguage = ref<WorkflowKind>()
const firstLanguage = computed(() => visibleWorkflowKinds()[0])
const emit = defineEmits<{ scaffoldWebsite: [project: { dir: string; rewrite: string }] }>()
const openScaffoldWebsite = (project: { dir: string; rewrite: string }) => {
  managedLanguage.value = undefined
  emit('scaffoldWebsite', project)
}
onMounted(() => { void controller.load() })
</script>
