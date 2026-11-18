<template><div class="terminal-panel"><header><div><p class="eyebrow">PQT FORGE / TERMINAL</p><h2>Integrated terminal</h2></div><button class="icon-button" @click="close">×</button></header><div ref="terminalHost" class="terminal-host"></div><footer><span class="muted">Managed PTY session</span><button class="action-button action-button--danger" @click="close">Close terminal</button></footer></div></template>
<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, ref } from 'vue'
import { terminalController } from '../state/terminalController'
const terminalHost=ref<HTMLElement>(); const emit=defineEmits<{close:[]}>(); const close=async()=>{await terminalController.close();emit('close')}; onMounted(()=>nextTick(()=>terminalHost.value&&terminalController.mount(terminalHost.value).catch(close))); onBeforeUnmount(()=>{if(terminalController.terminal.value) void terminalController.close()})
</script>
