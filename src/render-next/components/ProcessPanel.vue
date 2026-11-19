<template>
  <ForgeDialog title="Process control" description="Search ports or process commands, inspect the process tree, then confirm a stop." eyebrow="WORKSPACE / SYSTEM" wide @close="emit('close')">
    <div class="process-tabs"><button class="action-button" :class="{ active: kind === 'port' }" @click="kind = 'port'">Port</button><button class="action-button" :class="{ active: kind === 'process' }" @click="kind = 'process'">Process name</button></div>
    <div class="legacy-process-view pqt-established-tool dark"><PortKill v-if="kind === 'port'" /><ProcessKill v-else /></div>
  </ForgeDialog>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import ForgeDialog from './ForgeDialog.vue'
import PortKill from '@/components/Tools/PortKill/Index.vue'
import ProcessKill from '@/components/Tools/ProcessKill/Index.vue'
import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'
provideLegacyToolContext()
const emit = defineEmits<{ close: [] }>()
const kind = ref<'port' | 'process'>('port')
</script>
<style scoped>
.process-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.process-tabs .active { border-color: var(--pqt-accent); color: var(--pqt-accent); }
.legacy-process-view { display: flex; flex-direction: column; min-height: 440px; }
.legacy-process-view :deep(.nav) { display: none; }
.legacy-process-view :deep(.host-edit) { position: static; min-height: 440px; }
</style>
