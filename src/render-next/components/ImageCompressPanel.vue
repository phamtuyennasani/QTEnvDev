<template>
  <ForgeDialog title="Image compressor" description="Batch process images with the existing local Sharp pipeline." eyebrow="WORKSPACE / FILES" wide @close="emit('close')">
    <div class="image-panel">
      <div class="image-toolbar">
        <button class="action-button" :disabled="batch.busy" @click="batch.selectDir('file')">Add images</button>
        <button class="action-button" :disabled="batch.busy" @click="batch.selectDir('folder')">Add folder</button>
        <button class="action-button" :disabled="!batch.images.length || batch.busy" @click="batch.clear()">Clear</button>
      </div>
      <div class="image-settings">
        <label>Overwrite source<input v-model="batch.rewrite" type="checkbox" :disabled="batch.busy" /></label>
        <label v-if="!batch.rewrite">Save folder
          <button class="action-button" :disabled="batch.busy" @click="batch.selectSaveDir('save')">{{ batch.saveDir || 'Choose folder' }}</button>
        </label>
        <label v-else>Backup folder
          <button class="action-button" :disabled="batch.busy" @click="batch.selectSaveDir('backup')">{{ batch.backupDir || 'Choose folder' }}</button>
        </label>
      </div>
      <ImagePipelineOptions :disabled="batch.busy" />
      <p class="image-status" role="status">{{ batch.status }}</p>
      <p v-if="batch.error" class="forge-alert forge-alert--error" role="alert">{{ batch.error }}</p>
      <p v-for="warning in batch.warnings" :key="warning" class="forge-alert">{{ warning }}</p>
      <div class="image-list">
        <article v-for="image in batch.images" :key="image.path">
          <span><b>{{ image.path }}</b><small>{{ image.ext || 'image' }} · {{ image.width || '—' }}×{{ image.height || '—' }} · {{ image.sizeFormatted || 'reading…' }}</small><small v-if="image.errorMessage || image.result?.errorMessage" class="image-error">{{ image.result?.errorMessage || image.errorMessage }}</small><small v-else-if="image.result">{{ image.result.ext }} · {{ image.result.width }}×{{ image.result.height }} · {{ image.result.sizeFormatted }}</small></span>
          <em>{{ batch.outcomes[image.path] || (image.hasError ? 'failed' : image.status) }}</em><button class="text-button" :disabled="batch.busy" @click="batch.remove(image.path)">Remove</button>
        </article>
        <p v-if="!batch.images.length" class="empty-copy">Add one or more images to begin.</p>
      </div>
      <div class="image-toolbar"><button class="primary-button" :disabled="!batch.images.length || batch.busy" @click="batch.doProcess()">{{ batch.processing ? 'Processing…' : 'Compress images' }}</button><button class="action-button" :disabled="!batch.saveDir && !batch.backupDir" @click="batch.openOutput()">Open output folder</button></div>
    </div>
    <template #footer><span class="website-help">Work continues when this dialog closes. The image backend cannot cancel active writes; completed files and individual failures stay visible.</span></template>
  </ForgeDialog>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import ForgeDialog from './ForgeDialog.vue'
import ImagePipelineOptions from './ImagePipelineOptions.vue'
import { ImageBatch } from '@/components/Tools/ImageCompress/setup'

const emit = defineEmits<{ close: [] }>()
const batch = ImageBatch
onMounted(() => { void batch.init() })
onBeforeUnmount(() => batch.save())
</script>

<style scoped>
.image-panel { display: grid; gap: 14px; }
.image-toolbar { display: flex; gap: 7px; flex-wrap: wrap; }
.image-settings { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.image-settings label { display: grid; gap: 6px; color: var(--pqt-text-muted); font-size: 11px; }
.image-settings input { accent-color: var(--pqt-accent); }
.image-settings button { min-height: 34px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.image-list { display: grid; gap: 6px; max-height: 340px; overflow: auto; }
.image-list article { display: flex; justify-content: space-between; gap: 10px; padding: 10px; border: 1px solid var(--pqt-border); border-radius: 7px; }
.image-list span { display: grid; gap: 4px; min-width: 0; }
.image-list b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 10px var(--pqt-font-mono); }
.image-list small, .image-list em { color: var(--pqt-text-muted); font-size: 10px; font-style: normal; }
.image-list em { color: var(--pqt-accent); text-transform: uppercase; }
.image-error { color: var(--pqt-danger); }
.image-status { color: var(--pqt-text-muted); font-size: 12px; }
@media (max-width: 720px) { .image-settings { grid-template-columns: 1fr; } }
</style>
