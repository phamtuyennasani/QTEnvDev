<template>
  <section class="project-workflows panel">
    <div class="panel-heading"><div><p class="eyebrow">PROJECT WORKFLOWS</p><h2>Language projects</h2><p class="website-help">Run saved PHP, Node.js, Python and Go projects through their real process controller.</p></div><button class="action-button" :disabled="controller.loading || controller.busy" @click="controller.load()">{{ controller.loading ? 'Refreshing…' : 'Refresh' }}</button></div>
    <p v-if="controller.error" class="forge-alert forge-alert--error" role="alert">{{ controller.error }}</p>
    <div v-if="!controller.projects.length && !controller.loading" class="empty-copy">No saved language projects yet. Add one from the project workflow settings.</div>
    <div v-for="project in controller.projects" :key="project.id" class="workflow-row">
      <div class="workflow-main"><span class="project-icon">⌘</span><span><b>{{ project.item.comment || project.item.path }}</b><small>{{ labels[project.kind] }} · {{ project.item.path }}</small><small v-if="project.item.runCommand" class="workflow-command">$ {{ project.item.runCommand }}</small></span></div>
      <div class="workflow-facts"><code>127.0.0.1:{{ project.item.projectPort }}</code><span :class="['workflow-state', project.item.state.isRun ? 'is-running' : '']">{{ project.item.state.running ? 'Working…' : project.item.state.isRun ? 'Running' : 'Stopped' }}</span></div>
      <div class="workflow-actions"><button class="text-button" @click="controller.open(project.item.path)">Open folder ↗</button><button class="text-button" :disabled="!project.item.configPath?.length" @click="controller.revealFile(project, 'config')">Config ↗</button><button class="text-button" :disabled="!project.item.logPath?.length" @click="controller.revealFile(project, 'log')">Logs ↗</button><button v-if="project.item.state.isRun" class="action-button action-button--danger" :disabled="controller.busy" @click="controller.run(project, 'stop')">Stop</button><button v-else class="action-button action-button--primary" :disabled="controller.busy" @click="controller.run(project, 'start')">Start</button></div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { onMounted } from 'vue'
import { projectWorkflowController as controller } from '../state/projectWorkflowController'
const labels = { php: 'PHP', nodejs: 'Node.js', python: 'Python', golang: 'Go' } as const
onMounted(() => { void controller.load() })
</script>
