<template>
  <div v-if="dialog" class="dialog-backdrop" role="presentation">
    <section class="task-dialog" role="dialog" aria-modal="true" :aria-label="dialog.title">
      <div class="dialog-icon"><span>↗</span></div>
      <div class="dialog-copy"><p class="eyebrow">OPERATION IN PROGRESS</p><h2>{{ dialog.title }}</h2><p>{{ dialog.message }}</p></div>
      <div class="dialog-progress"><div class="progress-track"><span :style="{ width: `${dialog.progress ?? 0}%` }"></span></div><div class="progress-meta"><span>{{ dialog.progress ?? 0 }}%</span><span>Keep this window open</span></div></div>
      <button class="dialog-cancel" @click="closeTask()">Run in background</button>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { nextAppState, closeTask } from '../state/app'
const dialog = computed(() => nextAppState.dialog)
</script>
