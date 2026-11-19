<template>
  <ForgeDialog title="Base64 file converter" description="Convert a local file to Base64 or save Base64 data as a file." eyebrow="WORKSPACE / CONVERTER" wide @close="emit('close')">
    <div class="b64-panel">
      <section @dragover.prevent @drop.prevent="drop">
        <div class="b64-head"><b>File to Base64</b><button class="action-button" @click="choose">Choose file</button></div>
        <input :value="fileName" readonly placeholder="Choose or drop a file (up to 20 MB)" />
        <textarea :value="encoded" readonly rows="7" placeholder="Base64 data URL" />
        <button class="action-button" :disabled="!encoded" @click="clipboard.writeText(encoded)">Copy Base64</button>
      </section>
      <section>
        <b>Base64 to file</b><textarea v-model="input" rows="7" placeholder="Paste Base64 or a data URL" />
        <div class="b64-head"><button class="action-button" :disabled="!input.trim()" @click="showPreview = !showPreview">{{ showPreview ? 'Hide preview' : 'Preview image' }}</button><button class="primary-button" :disabled="!input.trim()" @click="save">Save file</button></div>
        <img v-if="showPreview && preview" class="b64-preview" :src="preview" alt="Decoded Base64 image preview" />
      </section>
      <p v-if="error" class="forge-alert forge-alert--error">{{ error }}</p>
      <p v-if="savedPath" class="website-help">Saved {{ savedPath }} <button class="text-button" @click="reveal">Show in folder</button></p>
    </div>
  </ForgeDialog>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import ForgeDialog from './ForgeDialog.vue'
import { dialog, fs, clipboard, shell } from '@/util/NodeFn'
import { fileToDataUrl, validateBase64File } from '../tools/fileBase64'
const emit = defineEmits<{ close: [] }>()
const fileName = ref(''), encoded = ref(''), input = ref(''), error = ref(''), savedPath = ref('')
const showPreview = ref(false)
const preview = computed(() => { try { return 'data:image/png;base64,' + validateBase64File(input.value) } catch { return '' } })
let fileGeneration = 0
const read = async (file?: File) => {
  if (!file) return
  const generation = ++fileGeneration
  fileName.value = file.name; encoded.value = ''; error.value = ''
  try { const result = await fileToDataUrl(file); if (generation === fileGeneration) encoded.value = result }
  catch (failure) { if (generation === fileGeneration) error.value = failure instanceof Error ? failure.message : String(failure) }
}
const choose = () => { const picker = document.createElement('input'); picker.type = 'file'; picker.onchange = () => { void read(picker.files?.[0]) }; picker.click() }
const drop = (event: DragEvent) => { void read(event.dataTransfer?.files[0]) }
const reveal = async () => { try { await shell.showItemInFolder(savedPath.value) } catch (failure) { error.value = 'File saved; folder could not be opened: ' + String(failure) } }
const save = async () => {
  error.value = ''; savedPath.value = ''
  let raw: string
  try { raw = validateBase64File(input.value) } catch (failure) { error.value = failure instanceof Error ? failure.message : String(failure); return }
  const picked = await dialog.showSaveDialog({ properties: ['createDirectory', 'showOverwriteConfirmation'] })
  if (picked.canceled || !picked.filePath) return
  try { await fs.writeBufferBase64(picked.filePath, raw); savedPath.value = picked.filePath; await reveal() }
  catch (failure) { error.value = failure instanceof Error ? failure.message : String(failure) }
}
</script>
<style scoped>
.b64-panel{display:grid;grid-template-columns:1fr 1fr;gap:14px}.b64-panel section{display:grid;gap:9px;align-content:start}.b64-head{display:flex;justify-content:space-between;align-items:center;gap:8px}.b64-panel input,.b64-panel textarea{width:100%;padding:10px;color:var(--pqt-text);background:var(--pqt-canvas);border:1px solid var(--pqt-border-strong);border-radius:7px;font:11px/1.5 var(--pqt-font-mono)}.b64-panel textarea{resize:vertical}.b64-preview{max-width:100%;max-height:220px;object-fit:contain}.b64-panel>p{grid-column:1/-1}
</style>
