<template>
  <ForgeDialog title="Flutter tools" wide @close="$emit('close')">
    <div class="detail-actions flutter-tool-tabs" role="group" aria-label="Flutter tools">
      <button class="action-button" :aria-pressed="tab === 'general'" @click="tab = 'general'">
        General
      </button>
      <button class="action-button" :aria-pressed="tab === 'android'" @click="tab = 'android'">
        Android
      </button>
    </div>
    <div class="pqt-established-tool flutter-tool-surface dark">
      <FlutterGeneral v-if="tab === 'general'" />
      <FlutterAndroid v-else />
    </div>
  </ForgeDialog>
</template>

<script setup lang="ts">
  import { defineAsyncComponent, ref } from 'vue'
  import ForgeDialog from './ForgeDialog.vue'
  import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'

  defineEmits<{ close: [] }>()
  provideLegacyToolContext({ detachedClass: 'pqt-flutter-tool' })
  const tab = ref<'general' | 'android'>('general')
  const FlutterGeneral = defineAsyncComponent(() => import('@/components/Flutter/General.vue'))
  const FlutterAndroid = defineAsyncComponent(
    () => import('@/components/Flutter/AndroidToolchain.vue')
  )
</script>

<style scoped>
  :global(.forge-dialog--wide:has(.flutter-tool-surface)) {
    width: 1100px;
  }

  .flutter-tool-tabs {
    margin-bottom: 12px;
  }

  .flutter-tool-tabs button[aria-pressed='true'] {
    color: var(--pqt-accent);
    border-color: var(--pqt-accent);
  }

  .flutter-tool-surface {
    height: min(600px, calc(100vh - 220px));
    min-height: 240px;
    overflow: auto;
  }
</style>
