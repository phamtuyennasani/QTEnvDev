<template>
  <ForgeDialog :title="surface?.title || 'Tool'" eyebrow="WORKSPACE / TOOLS" wide @close="emit('close')">
    <div class="pqt-established-tool dark" :data-tool="tool">
      <p v-if="error" class="forge-alert forge-alert--error">{{ error }} <button class="action-button" @click="load">Retry</button></p>
      <component :is="content" v-else-if="content" />
      <p v-else class="empty-copy">Loading tool…</p>
    </div>
  </ForgeDialog>
</template>
<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, shallowRef, ref, watch } from 'vue'
import ForgeDialog from './ForgeDialog.vue'
import { isLegacyToolSurface, legacyToolSurfaces } from '../tools/legacyToolSurfaces'
import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'

const props = defineProps<{ tool: string }>()
const emit = defineEmits<{ close: [] }>()
// Descendants resolve the established UI components in a private context. The shell's app,
// global component registry, stores and plugins remain owned by next-main.
provideLegacyToolContext()
const surface = computed(() => isLegacyToolSurface(props.tool) ? legacyToolSurfaces[props.tool] : undefined)
const content = shallowRef()
const error = ref('')
let generation = 0
const load = async () => {
  const current = ++generation
  content.value = undefined
  error.value = ''
  if (!surface.value) { error.value = 'This tool surface is unavailable.'; return }
  try { const module = await surface.value.load(); if (current === generation) content.value = markRaw(module.default) }
  catch (failure) { console.error('Tool surface failed to load:', props.tool, failure instanceof Error ? failure.stack : failure); if (current === generation) error.value = failure instanceof Error ? failure.message : String(failure) }
}
watch(() => props.tool, load, { immediate: true })
onBeforeUnmount(() => { generation++ })
</script>
