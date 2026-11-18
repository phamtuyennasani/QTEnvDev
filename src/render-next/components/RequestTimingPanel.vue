<template><div class="tool-panel"><header class="tool-panel-header"><div><p class="eyebrow">NETWORK / REQUEST TIMING</p><h2>Request timing</h2></div><button class="icon-button" @click="emit('close')">×</button></header><div class="request-form"><input v-model="controller.state.url" placeholder="https://example.com" @keyup.enter="controller.fetch()"/><button class="action-button action-button--primary" :disabled="controller.state.loading" @click="controller.fetch()">{{ controller.state.loading ? 'Measuring...' : 'Measure' }}</button></div><p v-if="controller.state.error" class="forge-alert forge-alert--error">{{ controller.state.error }}</p><div class="timing-list"><div v-for="metric in controller.state.list" :key="metric.Metric" class="timing-row"><span>{{ metric.Metric }}</span><code>{{ metric.Value }}</code></div><p v-if="!controller.state.list.length && !controller.state.loading" class="empty-copy">Enter a URL to inspect request timing.</p></div></div></template>
<script setup lang="ts">
import { requestTimingController } from '../state/requestTimingController'
const controller = requestTimingController
const emit = defineEmits<{ close: [] }>()
</script>
