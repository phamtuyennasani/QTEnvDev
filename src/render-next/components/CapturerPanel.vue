<template>
  <ForgeDialog title="Screen capturer" description="Capture a region or window and save it with a deterministic name." eyebrow="WORKSPACE / CAPTURE" @close="emit('close')">
    <div class="capture-form">
      <label>Save folder<div class="field-row"><input v-model="form.dir" placeholder="Ask on each capture" /><button class="action-button" @click="chooseFolder">Choose</button></div></label>
      <label>File name pattern<input ref="nameInput" v-model="form.name" /><span class="capture-tokens"><button v-for="token in tokens" :key="token" class="text-button" @click="insertToken(token)">{{ token }}</button></span></label>
      <label>Shortcut<input :value="form.key.join(' + ')" placeholder="Focus and press a shortcut" readonly @keydown.prevent.stop="recordShortcut" /><button class="text-button" @click="form.key = []">Clear shortcut</button></label>
      <label class="capture-checkbox"><input v-model="hideWindow" type="checkbox" /> Hide main window before capture</label>
      <div class="actions"><button class="primary-button" :disabled="controller.running || controller.saving || !controller.ready" @click="controller.capture(hideWindow, form)">{{ controller.running ? 'Capture active…' : 'Start capture' }}</button><button class="action-button" :disabled="!controller.running" @click="controller.cancel()">Stop</button><button class="action-button" :disabled="controller.running || controller.saving" @click="controller.saveConfig(form)">Save settings</button><button class="action-button" @click="controller.reconcile()">Check status</button></div>
      <p class="status" role="status">{{ controller.status }}</p><p v-if="controller.path" class="capture-path">{{ controller.path }}</p>
      <p v-if="controller.error || pickerError" class="forge-alert forge-alert--error" role="alert">{{ pickerError || controller.error }}</p><p v-if="controller.warning" class="forge-alert" role="status">{{ controller.warning }}</p>
    </div>
    <template #footer><span class="website-help">PNG output is limited to 50 MB and 100 megapixels. Naming rules never create subdirectories. Opening the capture window remains active until save or cancellation.</span></template>
  </ForgeDialog>
</template>
<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue'
import ForgeDialog from './ForgeDialog.vue'
import { dialog } from '@/util/NodeFn'
import { capturerController as controller } from '../state/capturerController'
const emit = defineEmits(['close'])
const form = reactive({ ...controller.config, key: [...controller.config.key] })
const hideWindow = ref(false)
const pickerError = ref('')
const nameInput = ref<HTMLInputElement>()
const tokens = ['{index}', '{timestamp}', '{datetime}', '{uuid}']
onMounted(async () => { await controller.init(); Object.assign(form, controller.config, { key: [...controller.config.key] }) })
const chooseFolder = async () => {
  try { const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory', 'showHiddenFiles'] }); if (!result.canceled && result.filePaths[0]) form.dir = result.filePaths[0] }
  catch (error) { pickerError.value = String(error) }
}
const insertToken = async (token: string) => { const input = nameInput.value; const start = input?.selectionStart ?? form.name.length; const end = input?.selectionEnd ?? start; form.name = form.name.slice(0, start) + token + form.name.slice(end); await nextTick(); input?.focus(); input?.setSelectionRange(start + token.length, start + token.length) }
const recordShortcut = (event: KeyboardEvent) => { const keys: string[] = []; if (event.metaKey) keys.push('Meta'); if (event.ctrlKey) keys.push('Control'); if (event.altKey) keys.push('Alt'); if (event.shiftKey) keys.push('Shift'); if (!['Meta','Control','Alt','Shift'].includes(event.key)) keys.push(event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key); form.key = keys }
</script>
<style scoped>
.capture-form{display:grid;gap:14px}.capture-form label{display:grid;gap:6px;color:var(--pqt-text-muted);font-size:11px}.capture-form input{padding:9px;color:var(--pqt-text);background:var(--pqt-canvas);border:1px solid var(--pqt-border);border-radius:7px}.field-row{display:flex;gap:8px}.field-row input{flex:1;min-width:0}.capture-tokens,.actions{display:flex;gap:8px;flex-wrap:wrap}.capture-form .capture-checkbox{display:flex;align-items:center;gap:8px}.status{color:var(--pqt-accent)}.capture-path{font:11px var(--pqt-font-mono);overflow-wrap:anywhere}
</style>
