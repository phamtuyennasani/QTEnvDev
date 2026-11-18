<template>
  <ForgeDialog title="UTF-8 BOM cleaner" description="Scan a folder, choose file types, then remove only UTF-8 BOM markers." eyebrow="WORKSPACE / FILES" wide @close="emit('close')">
    <div class="bom-panel">
      <label>Folder or file <div class="bom-path"><input v-model="path" placeholder="Select a directory or file" /><button class="action-button" :disabled="loading || running" @click="choose">Browse</button></div></label>
      <label>Exclude paths <textarea v-model="exclude" rows="3" placeholder="node_modules&#10;.git&#10;.vscode" /></label>
      <div class="bom-actions"><button class="primary-button" :disabled="!path || loading || running" @click="scan">{{ loading ? 'Scanning…' : 'Scan files' }}</button><button class="action-button" :disabled="!files.length || loading || running" @click="clean">{{ running ? 'Cleaning…' : 'Remove BOM markers' }}</button></div>
      <p v-if="error" class="forge-alert forge-alert--error">{{ error }}</p>
      <div v-if="files.length" class="bom-summary"><b>{{ files.length }}</b> candidate files <span v-if="result"> · {{ result.success }} cleaned · {{ result.fail }} failed</span></div>
      <div v-if="files.length" class="bom-files"><code v-for="file in files.slice(0, 100)" :key="file">{{ file }}</code><small v-if="files.length > 100">Showing first 100 files.</small></div>
    </div>
    <template #footer><span class="website-help">Scanning uses the existing local file service.</span><button class="action-button" @click="reset">Reset</button></template>
  </ForgeDialog>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import ForgeDialog from './ForgeDialog.vue'
import IPC from '@/util/IPC'
import { dialog } from '@/util/NodeFn'
const emit = defineEmits<{ close: [] }>()
const path=ref(''); const exclude=ref('.idea\n.git\n.svn\n.vscode\nnode_modules'); const files=ref<string[]>([]); const loading=ref(false); const running=ref(false); const error=ref(''); const result=ref<{success:number;fail:number}>()
const request=(method:string,...args:unknown[])=>new Promise<any>((resolve,reject)=>{IPC.send('app-fork:tools',method,...args).then((key:string,res:any)=>{IPC.off(key);res?.code===0?resolve(res.data):reject(new Error(res?.msg??method+' failed'))})})
const choose=async()=>{const picked=await dialog.showOpenDialog({properties:['openDirectory','openFile','showHiddenFiles']});if(!picked.canceled&&picked.filePaths[0]){path.value=picked.filePaths[0];await scan()}}
const scan=async()=>{if(!path.value)return;loading.value=true;error.value='';result.value=undefined;try{const list=await request('getAllFile',path.value);const excluded=exclude.value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);files.value=(list??[]).filter((file:string)=>!excluded.some(token=>file.includes(token)))}catch(e){error.value=e instanceof Error?e.message:String(e)}finally{loading.value=false}}
const clean=async()=>{running.value=true;error.value='';try{const data=await request('cleanBom',files.value);result.value={success:data?.success??0,fail:data?.fail??0}}catch(e){error.value=e instanceof Error?e.message:String(e)}finally{running.value=false}}
const reset=()=>{path.value='';files.value=[];result.value=undefined;error.value=''}
</script>
<style scoped>
.bom-panel{display:grid;gap:15px;font-size:12px}.bom-panel label{display:grid;gap:7px;color:var(--pqt-text-muted)}.bom-path{display:flex;gap:8px}.bom-path input,.bom-panel textarea{flex:1;min-width:0;padding:9px 10px;color:var(--pqt-text);background:var(--pqt-canvas);border:1px solid var(--pqt-border-strong);border-radius:7px;font:12px var(--pqt-font-mono)}.bom-panel textarea{resize:vertical}.bom-actions{display:flex;gap:8px}.bom-summary{padding:10px 12px;border:1px solid var(--pqt-border);border-radius:7px;color:var(--pqt-text-muted)}.bom-summary b{color:var(--pqt-accent)}.bom-files{display:grid;gap:3px;max-height:220px;overflow:auto;padding:10px;background:var(--pqt-canvas);border:1px solid var(--pqt-border);border-radius:7px}.bom-files code{font-size:10px;color:var(--pqt-text-muted);white-space:nowrap}.bom-files small{color:var(--pqt-text-dim)}
</style>
