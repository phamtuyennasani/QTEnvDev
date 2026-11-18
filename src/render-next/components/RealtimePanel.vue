<template><div class="tool-panel"><header class="tool-panel-header"><div><p class="eyebrow">NETWORK / REALTIME</p><h2>WebSocket / SSE</h2></div><button class="icon-button" @click="close">×</button></header><div class="realtime-form"><select v-model="controller.state.mode"><option value="websocket">WebSocket</option><option value="sse">SSE</option></select><input v-model="controller.state.url" placeholder="ws://localhost:8080" @keyup.enter="connect"/><button class="action-button action-button--primary" :disabled="controller.state.busy||controller.state.connected" @click="connect">{{controller.state.busy?'Connecting...':'Connect'}}</button><button v-if="controller.state.connected" class="action-button action-button--danger" @click="controller.disconnect()">Disconnect</button></div><p v-if="controller.state.error" class="forge-alert forge-alert--error">{{controller.state.error}}</p><div v-if="controller.state.mode==='websocket'" class="realtime-send"><input v-model="controller.state.message" placeholder="Message" @keyup.enter="controller.send()"/><button class="action-button" :disabled="!controller.state.connected" @click="controller.send()">Send</button></div><div class="timing-list"><div v-for="(event,index) in controller.state.events" :key="index" class="timing-row"><code>{{event}}</code></div><p v-if="!controller.state.events.length" class="empty-copy">Events will appear here.</p></div><footer><button class="text-button" @click="controller.clear()">Clear events</button></footer></div></template>
<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { realtimeController } from '../state/realtimeController'
const controller = realtimeController
const emit = defineEmits<{ close: [] }>()
const connect = () => controller.connect()
const close = () => { controller.disconnect(); emit('close') }
onBeforeUnmount(() => controller.disconnect())
</script>
