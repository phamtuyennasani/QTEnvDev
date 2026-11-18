<template><section class="screen logs-screen"><header class="page-header"><div><p class="eyebrow">WORKSPACE / LOGS</p><h1>Operation logs</h1><p class="subtitle">A readable timeline for services, installs and system events.</p></div><div><button class="action-button" @click="exportLogs">Export</button><button class="action-button" @click="liveOpen=true">Live file</button><button class="action-button" @click="clearLogs">Clear</button></div></header><div class="logs-toolbar"><label class="search-box logs-search"><span>⌕</span><input v-model="logController.query.value" placeholder="Search logs" /></label><div class="log-tabs"><button v-for="item in logController.levels" :key="item" :class="{ active: logController.level.value === item }" @click="logController.level.value = item">{{ item }}</button></div><span class="live-indicator"><i class="status-dot status-dot--running"></i> Live</span></div><article class="panel log-panel"><div class="log-header"><span>Time</span><span>Source</span><span>Event</span></div><div v-for="entry in entries" :key="entry.id" class="log-row"><code>{{ entry.time }}</code><span class="log-source">{{ entry.source }}</span><span class="log-message">{{ entry.message }}</span></div><p v-if="entries.length === 0" class="empty-copy">No log events match this filter.</p></article><LiveLogPanel v-if="liveOpen" @close="liveOpen=false" /></section></template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { logController } from '../state/logController'
import { showNotice } from '../state/app'
import LiveLogPanel from '../components/LiveLogPanel.vue'
const entries = computed(() => logController.filtered.value); const liveOpen=ref(false)
const clearLogs = () => { logController.clear(); showNotice('Log stream cleared') }
const exportLogs = () => {
  const text = logController.entries.map((entry) => `[${entry.time}] [${entry.level}] [${entry.source}] ${entry.message}`).join('\n')
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `pqt-forge-logs-${Date.now()}.log`; link.click(); URL.revokeObjectURL(url); showNotice('Log export downloaded')
}
</script>

