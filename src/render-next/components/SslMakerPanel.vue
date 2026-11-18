<template>
  <ForgeDialog title="Local SSL maker" description="Create development certificates signed by a local root CA." eyebrow="WORKSPACE / SECURITY" wide @close="emit('close')">
    <div class="ssl-panel">
      <label>Domains <textarea v-model="domains" rows="5" placeholder="localhost&#10;*.project.test" /></label>
      <label>Root CA certificate (optional) <div class="ssl-path"><input v-model="root" placeholder="Leave empty to create a new root CA" /><button class="action-button" :disabled="running" @click="chooseRoot">Browse</button></div></label>
      <label>Certificate save folder <div class="ssl-path"><input v-model="savePath" placeholder="Choose a folder for generated files" /><button class="action-button" :disabled="running" @click="chooseSave">Browse</button></div></label>
      <p v-if="error" class="forge-alert forge-alert--error">{{ error }}</p><p v-if="done" class="forge-alert">Certificate generation completed. Files were written to the selected folder.</p>
      <button class="primary-button" :disabled="running || !domains.trim() || !savePath.trim()" @click="generate">{{ running ? 'Generating…' : 'Generate certificates' }}</button>
    </div>
    <template #footer><span class="website-help">For local development only. Do not use these certificates in production.</span><button class="action-button" @click="clear">Clear</button></template>
  </ForgeDialog>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import ForgeDialog from './ForgeDialog.vue'
import IPC from '@/util/IPC'
import { dialog, shell } from '@/util/NodeFn'
const emit=defineEmits<{close:[]}>(); const domains=ref(''); const root=ref(''); const savePath=ref(''); const running=ref(false); const error=ref(''); const done=ref(false)
const chooseRoot=async()=>{const r=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'ROOT CA Certificate',extensions:['crt']}]});if(!r.canceled&&r.filePaths[0])root.value=r.filePaths[0]}
const chooseSave=async()=>{const r=await dialog.showOpenDialog({properties:['openDirectory','createDirectory']});if(!r.canceled&&r.filePaths[0])savePath.value=r.filePaths[0]}
const generate=async()=>{if(running.value)return;running.value=true;error.value='';done.value=false;try{await new Promise<void>((resolve,reject)=>{IPC.send('app-fork:tools','sslMake',{domains:domains.value,root:root.value,savePath:savePath.value}).then((key:string,res:any)=>{IPC.off(key);res?.code===0?resolve():reject(new Error(res?.msg??'Certificate generation failed'))})});done.value=true;await shell.openPath(savePath.value)}catch(e){error.value=e instanceof Error?e.message:String(e)}finally{running.value=false}}
const clear=()=>{domains.value='';root.value='';savePath.value='';error.value='';done.value=false}
</script>
<style scoped>
.ssl-panel{display:grid;gap:14px;font-size:12px}.ssl-panel label{display:grid;gap:7px;color:var(--pqt-text-muted)}.ssl-path{display:flex;gap:8px}.ssl-panel input,.ssl-panel textarea{width:100%;min-width:0;padding:9px 10px;color:var(--pqt-text);background:var(--pqt-canvas);border:1px solid var(--pqt-border-strong);border-radius:7px;font:12px var(--pqt-font-mono)}.ssl-panel textarea{resize:vertical}.ssl-panel .primary-button{justify-self:start}
</style>
