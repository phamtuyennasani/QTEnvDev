<template>
  <ForgeDialog :title="library.opened?.label || 'Custom tool'" :description="library.opened?.component" eyebrow="WORKSPACE / CUSTOM TOOL" wide @close="library.close()">
    <div class="custom-tool-toolbar"><span role="status">{{ library.pageStatus === 'loading' ? 'Loading…' : library.pageStatus === 'ready' ? 'Loaded' : library.pageStatus === 'failed' ? 'Load failed' : '' }}</span><button class="action-button" @click="library.reload()">Reload</button><button class="action-button" @click="library.openExternal()">Open in browser</button><button v-if="library.opened" class="action-button" :aria-pressed="library.isFavorite(library.opened.id)" @click="library.toggleFavorite(library.opened.id)">{{ library.isFavorite(library.opened.id) ? 'Remove favorite' : 'Add favorite' }}</button></div>
    <p v-if="library.pageError" class="forge-alert forge-alert--error" role="alert">{{ library.pageError }}</p>
    <p v-if="library.externalError" class="forge-alert forge-alert--error" role="alert">{{ library.externalError }}</p>
    <webview v-if="library.opened" ref="view" :src="library.opened.component" class="custom-tool-webview" />
  </ForgeDialog>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import ForgeDialog from './ForgeDialog.vue'
import { toolLibraryController as library } from '../state/toolLibraryController'
const view = ref<any>()
onMounted(async () => { await nextTick(); if (view.value) library.attach(view.value) })
onBeforeUnmount(() => library.detach())
</script>
<style scoped>
.custom-tool-toolbar{display:flex;gap:8px;align-items:center;margin-bottom:12px}.custom-tool-toolbar span{margin-right:auto;color:var(--pqt-text-muted);font-size:11px}.custom-tool-webview{display:flex;width:100%;height:440px;min-height:260px;border:1px solid var(--pqt-border);border-radius:6px;background:white}
</style>
