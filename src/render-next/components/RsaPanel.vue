<template>
  <ForgeDialog title="RSA key generator" description="Generate a local public/private RSA key pair." eyebrow="WORKSPACE / SECURITY" wide @close="emit('close')">
    <div class="rsa-panel">
      <div class="rsa-toolbar"><label>Key size<input v-model.number="bits" :disabled="controller.operation.running" type="number" min="512" max="16384" step="8" /></label><button class="primary-button" :disabled="controller.operation.running" @click="controller.generate(bits)">{{ controller.operation.running ? 'Generating…' : 'Generate key pair' }}</button></div>
      <p v-if="controller.operation.error" class="forge-alert forge-alert--error">{{ controller.operation.error }}</p>
      <div class="rsa-columns"><section><div><b>Public key</b><button class="text-button" :disabled="!controller.publicKey" @click="copy(controller.publicKey)">Copy</button></div><textarea :value="controller.publicKey" readonly rows="14" /></section><section><div><b>Private key</b><button class="text-button" :disabled="!controller.privateKey" @click="copy(controller.privateKey)">Copy</button></div><textarea :value="controller.privateKey" readonly rows="14" /></section></div>
    </div>
    <template #footer><span class="website-help">Keys remain available when this dialog is reopened. A slow generator stays guarded until it returns.</span></template>
  </ForgeDialog>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import ForgeDialog from './ForgeDialog.vue'
import { clipboard } from '@/util/NodeFn'
import { rsaController as controller } from '../state/rsaController'
const emit = defineEmits<{ close: [] }>()
const bits = ref(2048)
const copy = (value: string) => clipboard.writeText(value)
</script>
<style scoped>
.rsa-panel{display:grid;gap:14px}.rsa-toolbar{display:flex;align-items:end;gap:10px}.rsa-toolbar label{display:grid;gap:7px;color:var(--pqt-text-muted);font-size:11px}.rsa-toolbar input{width:130px;padding:9px;color:var(--pqt-text);background:var(--pqt-canvas);border:1px solid var(--pqt-border-strong);border-radius:7px;font:12px var(--pqt-font-mono)}.rsa-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px}.rsa-columns section{display:grid;gap:7px}.rsa-columns section>div{display:flex;justify-content:space-between;align-items:center}.rsa-columns textarea{width:100%;resize:vertical;padding:10px;color:#b3d7ce;background:var(--pqt-canvas);border:1px solid var(--pqt-border-strong);border-radius:7px;font:10px/1.5 var(--pqt-font-mono)}
</style>
