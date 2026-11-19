<template>
  <ForgeDialog :title="tool.name" :description="tool.description" eyebrow="WORKSPACE / LOCAL UTILITIES" wide @close="emit('close')">
    <form class="local-tool-form" @submit.prevent="run">
      <p v-if="tool.id === 'jwt'" class="forge-alert">Decode only. This inspector does not verify a signature, issuer, audience or expiry. Do not use its output as an authorization decision.</p>
      <div class="local-tool-controls">
        <label v-if="['base64', 'url', 'html'].includes(tool.id)">Operation<select v-model="mode"><option value="encode">{{ tool.id === 'html' ? 'Escape' : 'Encode' }}</option><option value="decode">{{ tool.id === 'html' ? 'Unescape' : 'Decode' }}</option></select></label>
        <label v-if="tool.id === 'json'">Output<select v-model="mode"><option value="encode">Pretty print · 2 spaces</option><option value="minify">Minify</option></select></label>
        <label v-if="tool.id === 'hash'">Algorithm<select v-model="algorithm"><option v-for="item in algorithms" :key="item">{{ item }}</option></select></label>
        <label v-if="tool.id === 'hash'">Encoding<select v-model="encoding"><option value="hex">Hexadecimal</option><option value="binary">Binary</option><option value="base64">Base64</option><option value="base64url">Base64url</option></select></label>
        <label v-if="tool.id === 'timestamp'">Numeric input unit<select v-model="mode"><option value="encode">Unix seconds</option><option value="milliseconds">Unix milliseconds</option></select></label>
        <label v-if="tool.id === 'base64'">URL-safe alphabet<input v-model="urlSafe" type="checkbox" /></label>
        <button type="submit" class="primary-button" :disabled="working">{{ working ? 'Processing…' : tool.id === 'diff' ? 'Compare texts' : 'Run locally' }}</button>
      </div>
      <div class="local-tool-inputs" :class="{ 'local-tool-inputs--pair': tool.id === 'diff' }"><label>{{ tool.id === 'diff' ? 'Original text' : 'Input' }}<textarea v-model="input" autofocus spellcheck="false" :placeholder="placeholder" /></label><label v-if="tool.id === 'diff'">Changed text<textarea v-model="second" spellcheck="false" placeholder="Paste changed text" /></label></div>
      <p v-if="error" class="forge-alert forge-alert--error" role="alert">{{ error }}</p>
      <label v-if="output !== undefined">Result <span v-if="stale">(input changed · run again)</span><textarea :value="output" class="local-tool-output" readonly spellcheck="false" /></label>
    </form>
    <template #footer><span class="website-help" role="status">{{ copied ? 'Copied to clipboard.' : 'Processed on this device. No data is sent to a website.' }}</span><div class="detail-actions"><button class="action-button" @click="clear">Clear</button><button class="action-button" :disabled="output === undefined || stale" @click="copy">Copy result</button></div></template>
  </ForgeDialog>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ForgeDialog from '../components/ForgeDialog.vue'
import type { ToolItem } from '../state/toolController'
import { transform, type LocalTool, type HashAlgorithm, type HashEncoding } from './transforms'
const props = defineProps<{ tool: ToolItem }>()
const emit = defineEmits<{ close: [] }>()
const input = ref(''); const second = ref(''); const mode = ref('encode'); const algorithm = ref<HashAlgorithm>('SHA-256'); const encoding = ref<HashEncoding>('hex')
const algorithms: HashAlgorithm[] = ['MD5', 'SHA-1', 'SHA-224', 'SHA-256', 'SHA-384', 'SHA-512', 'SHA3', 'RIPEMD160']
const urlSafe = ref(false)
const output = ref<string>(); const error = ref(''); const working = ref(false); const stale = ref(false); const copied = ref(false)
let generation = 0
watch([input, second, mode, algorithm, encoding, urlSafe], () => { generation++; working.value = false; stale.value = output.value !== undefined; copied.value = false })
const placeholder = computed(() => props.tool.id === 'json' ? '{"project":"PQT Forge"}' : props.tool.id === 'timestamp' ? 'Unix timestamp or 2026-11-18T12:00:00+07:00' : props.tool.id === 'jwt' ? 'Paste header.payload.signature' : 'Paste text here')
const run = async () => {
  const sequence = ++generation; working.value = true; error.value = ''; copied.value = false
  try { const result = await transform(props.tool.id as LocalTool, input.value, { mode: mode.value, second: second.value, algorithm: algorithm.value, encoding: encoding.value, urlSafe: urlSafe.value }); if (generation === sequence) { output.value = result; stale.value = false } }
  catch (failure) { if (generation === sequence) { error.value = failure instanceof Error ? failure.message : String(failure); output.value = undefined } }
  finally { if (generation === sequence) working.value = false }
}
const clear = () => { generation++; input.value = ''; second.value = ''; output.value = undefined; error.value = ''; copied.value = false; working.value = false }
const copy = async () => {
  if (output.value === undefined || stale.value) return
  try { await navigator.clipboard.writeText(output.value); copied.value = true }
  catch { error.value = 'Clipboard access failed. Select and copy the result directly.' }
}
onBeforeUnmount(() => { generation++ })
</script>
<style scoped>
.local-tool-form { display:grid; gap:16px; font-size:12px }
.local-tool-form label { display:flex; flex-direction:column; gap:8px; color:var(--pqt-text-muted) }
.local-tool-form select { padding:8px 10px; color:var(--pqt-text); background:var(--pqt-canvas); border:1px solid var(--pqt-border-strong); border-radius:6px }
.local-tool-controls { display:flex; gap:14px; justify-content:space-between; align-items:end }
.local-tool-inputs { display:grid; gap:12px } .local-tool-inputs--pair { grid-template-columns:1fr 1fr }
.local-tool-form textarea { display:block; width:100%; min-height:160px; padding:12px; resize:vertical; color:var(--pqt-text); background:var(--pqt-canvas); border:1px solid var(--pqt-border-strong); border-radius:7px; font:12px/1.6 var(--pqt-font-mono) }
.local-tool-form .local-tool-output { min-height:180px; color:#b3d7ce } .local-tool-form .forge-alert { margin:0 }
</style>
