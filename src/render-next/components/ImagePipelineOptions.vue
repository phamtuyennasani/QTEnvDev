<template>
  <div class="pipeline-options pqt-established-tool dark">
    <nav class="option-tabs" aria-label="Image options">
      <button v-for="tab in tabs" :key="tab.id" class="action-button" :class="{ active: active === tab.id }" @click="active = tab.id">{{ tab.label }}</button>
    </nav>
    <fieldset :disabled="disabled" class="options-body">
      <BasicConfig v-if="active === 'basic'" />
      <CompressConfig v-else-if="active === 'compression'" />
      <EffectsConfig v-else-if="active === 'effects'" />
      <WatermarkConfig v-else-if="active === 'watermark'" />
      <TextureConfig v-else-if="active === 'texture'" />
      <div v-else class="advanced-options">
        <p>Every Sharp option is available here, including GIF, TIFF, HEIF, resize position, alpha, CLAHE and encoder settings. Apply validates the configuration before changing the saved options.</p>
        <textarea v-model="json" spellcheck="false" aria-label="Complete image configuration" />
        <div class="option-actions"><button class="action-button" @click="readConfig">Read current options</button><button class="primary-button" @click="applyConfig">Apply options</button></div>
        <p v-if="error" class="forge-alert forge-alert--error" role="alert">{{ error }}</p>
      </div>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import BasicConfig from '@/components/Tools/ImageCompress/BasicConfig.vue'
import CompressConfig from '@/components/Tools/ImageCompress/CompressConfig.vue'
import EffectsConfig from '@/components/Tools/ImageCompress/EffectsConfig.vue'
import WatermarkConfig from '@/components/Tools/ImageCompress/WatermarkConfig.vue'
import TextureConfig from '@/components/Tools/ImageCompress/TextureConfig.vue'
import setup from '@/components/Tools/ImageCompress/setup'
import { snapshotImageConfig } from '@/components/Tools/ImageCompress/ImagePipelineConfig'
import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'
provideLegacyToolContext()

defineProps<{ disabled: boolean }>()
const tabs = [{ id: 'basic', label: 'Basic / preview' }, { id: 'compression', label: 'Compression / preview' }, { id: 'effects', label: 'Effects / preview' }, { id: 'watermark', label: 'Watermark / preview' }, { id: 'texture', label: 'Texture / preview' }, { id: 'advanced', label: 'All options' }]
const active = ref('basic')
const json = ref(JSON.stringify(snapshotImageConfig(setup), null, 2))
const error = ref('')
const readConfig = () => { json.value = JSON.stringify(snapshotImageConfig(setup), null, 2); error.value = '' }
watch(active, (tab) => { if (tab === 'advanced') readConfig() })
const applyConfig = () => {
  try { Object.assign(setup, snapshotImageConfig(JSON.parse(json.value))); readConfig() }
  catch (failure) { error.value = failure instanceof Error ? failure.message : String(failure) }
}
</script>

<style scoped>
.pipeline-options { min-width: 0; height: auto; min-height: 0; }
.option-tabs, .option-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.option-tabs { margin-bottom: 12px; }
.option-tabs .active { color: var(--pqt-accent); border-color: var(--pqt-accent); }
.options-body { min-width: 0; margin: 0; padding: 14px; border: 1px solid var(--pqt-border); border-radius: 7px; }
.options-body:disabled { opacity: .65; pointer-events: none; }
.advanced-options { display: grid; gap: 12px; color: var(--pqt-text-muted); font-size: 12px; }
.advanced-options textarea { width: 100%; min-height: 360px; padding: 12px; color: var(--pqt-text); background: var(--pqt-canvas); border: 1px solid var(--pqt-border); border-radius: 7px; font: 12px/1.5 var(--pqt-font-mono); }
</style>
