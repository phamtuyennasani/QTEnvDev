<template><div class="tool-panel live-log-panel"><header class="tool-panel-header"><div><p class="eyebrow">LOGS / LIVE VIEW</p><h2>Live log viewer</h2></div><button class="icon-button" @click="close">×</button></header><div class="live-log-toolbar"><input v-model="controller.state.path" placeholder="Absolute log file path" @keyup.enter="controller.start()"/><button class="action-button action-button--primary" @click="controller.state.watching?controller.stop():controller.start()">{{controller.state.watching?'Stop watch':'Watch'}}</button><button class="action-button" @click="controller.read()">Refresh</button><button class="action-button" @click="controller.reveal()">Reveal</button><button class="action-button action-button--danger" @click="controller.clear()">Clear</button></div><p v-if="controller.state.error" class="forge-alert forge-alert--error">{{controller.state.error}}</p><pre class="live-log-content">{{controller.state.content||'Choose a log file path to begin watching.'}}</pre></div></template>
<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { liveLogController } from '../state/liveLogController'
const controller=liveLogController
const emit=defineEmits<{close:[]}>()
const close=()=>{controller.stop();emit('close')}
onBeforeUnmount(()=>controller.stop())
</script>
