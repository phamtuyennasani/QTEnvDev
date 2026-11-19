<template>
  <ForgeDialog title="Cloudflare Tunnel" wide @close="$emit('close')">
    <div class="pqt-established-tool forge-tunnel-list dark">
      <TunnelList v-if="store.inited" />
      <div v-else-if="store.loadError" class="forge-alert" role="alert">
        <p>{{ store.loadError }}</p>
        <button type="button" class="action-button" @click="load">Retry</button>
      </div>
      <p v-else role="status">Loading saved tunnels…</p>
    </div>
  </ForgeDialog>
</template>

<script setup lang="ts">
  import TunnelList from '@/components/CloudflareTunnel/List.vue'
  import store from '@/core/CloudflareTunnel/CloudflareTunnelStore'
  import ForgeDialog from '../components/ForgeDialog.vue'
  import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'

  defineEmits<{ close: [] }>()
  provideLegacyToolContext({ poperFix: true, detachedClass: 'forge-tunnel-list' })
  const load = () => void store.init().catch(() => undefined)
  load()
</script>

<style scoped>
  :global(.forge-dialog--wide:has(.forge-tunnel-list)) {
    width: 1040px;
  }

  .forge-tunnel-list :deep(.card-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
</style>
