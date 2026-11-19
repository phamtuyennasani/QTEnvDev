<template>
  <section class="screen">
    <header class="page-header"><div><p class="eyebrow">WORKSPACE / OVERVIEW</p><h1>Environment overview</h1><p class="subtitle">Your local development stack at a glance.</p></div><button class="primary-button" @click="startGroup"><span class="button-glyph">▶</span> Start group</button></header>
    <div class="metric-grid">
      <article class="metric-card metric-card--accent">
        <span class="metric-label">Services running</span>
        <strong>{{ runningCount }}</strong>
        <span class="metric-meta">{{ reportedCount }} of {{ services.length }} statuses reported</span>
      </article>
      <article class="metric-card">
        <span class="metric-label">Websites</span><strong>{{ websiteCount }}</strong>
        <span class="metric-meta">{{ websiteMeta }}</span>
      </article>
      <article class="metric-card">
        <span class="metric-label">Unknown service status</span><strong>{{ unknownCount }}</strong>
        <span class="metric-meta">Awaiting a service status report</span>
      </article>
    </div>
    <div class="content-grid"><article class="panel service-panel"><div class="panel-heading"><div><p class="eyebrow">ACTIVE SERVICES</p><h2>Running now</h2></div><button class="text-button" @click="navigateNext('services')">View all <span>→</span></button></div><div class="service-list"><div v-for="service in visibleServices" :key="service.name" class="service-row"><span class="status-dot" :class="`status-dot--${service.state}`"></span><span class="service-name">{{ service.name }}</span><code>{{ service.version }}</code><span v-if="service.port !== undefined" class="service-port">:{{ service.port }}</span><button class="row-action" aria-label="Open service" @click="navigateNext('services')">···</button></div></div></article><article class="panel quick-panel"><div class="panel-heading"><div><p class="eyebrow">QUICK ACCESS</p><h2>Build something</h2></div></div><button class="quick-action" @click="navigateNext('websites')"><span class="quick-icon">⌁</span><span><b>New website</b><small>Set up a local project</small></span><span>↗</span></button><button class="quick-action" @click="navigateNext('runtimes')"><span class="quick-icon">⌘</span><span><b>Install runtime</b><small>Add a version to your stack</small></span><span>↗</span></button><button class="quick-action" @click="navigateNext('tools')"><span class="quick-icon">✦</span><span><b>Open toolbox</b><small>Utilities for daily work</small></span><span>↗</span></button></article></div>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { navigateNext } from '../state/app'
import { serviceController } from '../state/serviceController'
import { projectController } from '../state/projectController'
import { startupGroupController } from '../state/startupGroupController'
const services = serviceController.services
const reportedCount = computed(() => services.filter((service) =>
  ['running', 'stopped', 'not-installed'].includes(service.state)
).length)
const runningCount = computed(() => reportedCount.value ? serviceController.runningCount.value : '—')
const unknownCount = computed(() => services.length - reportedCount.value)
const visibleServices = computed(() => services.filter((service) => service.state === 'running'))
const websiteCount = computed(() => projectController.projects.length)
const websiteMeta = computed(() => projectController.loading ? 'Loading saved hosts…' : projectController.error ? 'Unable to read saved hosts' : websiteCount.value === 0 ? 'No saved hosts' : `${websiteCount.value} saved host${websiteCount.value === 1 ? '' : 's'}`)
const startGroup = () => { void startupGroupController.runDefault() }
onMounted(() => { void serviceController.refresh(); void projectController.refresh(); void startupGroupController.init() })
</script>
