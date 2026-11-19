<template>
  <ForgeDialog :title="tab === 'users' ? 'n8n users' : 'n8n packages'" wide @close="emit('close')">
    <div class="pqt-established-tool n8n-workspace">
      <Users v-if="tab === 'users'" />
      <Manager v-else />
    </div>
  </ForgeDialog>
</template>

<script setup lang="ts">
  import { defineAsyncComponent } from 'vue'
  import ForgeDialog from './ForgeDialog.vue'
  import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'

  defineProps<{ tab: 'users' | 'packages' }>()
  const emit = defineEmits<{ close: [] }>()
  provideLegacyToolContext({ poperFix: true, detachedClass: 'pqt-n8n-workspace' })

  const Users = defineAsyncComponent(() => import('@/components/N8N/Users.vue'))
  const Manager = defineAsyncComponent(() => import('@/components/N8N/Manager.vue'))
</script>

<style scoped>
  .n8n-workspace {
    min-height: min(440px, 60vh);
  }
</style>
