<template>
  <ForgeDialog title="System environment files" description="Inspect shell startup files and save changes through the privileged file service." eyebrow="WORKSPACE / FILES" wide @close="emit('close')">
    <div class="env-panel"><div class="env-files"><button v-for="file in files" :key="file" :class="{active:file===selected}" @click="open(file)">{{ file }}</button><p v-if="!files.length&&!loading" class="empty-copy">No environment files were found.</p></div><div class="env-editor"><div class="env-editor-head"><code>{{ selected || 'Select a file' }}</code><button class="action-button" :disabled="!selected||saving||readOnly" @click="save">{{ saving?'Saving…':'Save file' }}</button></div><textarea v-model="content" :disabled="!selected||readOnly" spellcheck="false" placeholder="Select a file to edit" /><small v-if="readOnly" class="website-help">This system file is read-only on the current platform.</small><p v-if="error" class="forge-alert forge-alert--error">{{ error }}</p></div></div>
  </ForgeDialog>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ForgeDialog from './ForgeDialog.vue'
import IPC from '@/util/IPC'
const emit=defineEmits<{close:[]}>(); const files=ref<string[]>([]); const selected=ref(''); const content=ref(''); const loading=ref(false); const saving=ref(false); const error=ref(''); const readOnly=ref(false)
const invoke=(method:string,...args:unknown[])=>new Promise<any>((resolve,reject)=>{IPC.send('app-fork:tools',method,...args).then((key:string,res:any)=>{IPC.off(key);res?.code===0?resolve(res.data):reject(new Error(res?.msg??'Environment file operation failed'))})})
const open=async(file:string)=>{selected.value=file;error.value='';readOnly.value=!window.Server.isWindows&&/^\/(?:etc|private\/etc|opt\/local)(?:\/|$)/.test(file);try{content.value=await invoke('readFileByRoot',file)??''}catch(e){error.value=e instanceof Error?e.message:String(e)}}
const save=async()=>{if(!selected.value||readOnly.value)return;saving.value=true;error.value='';try{await invoke('systemEnvSave',selected.value,content.value)}catch(e){error.value=e instanceof Error?e.message:String(e)}finally{saving.value=false}}
onMounted(async()=>{loading.value=true;try{files.value=await invoke('systemEnvFiles')??[]}catch(e){error.value=e instanceof Error?e.message:String(e)}finally{loading.value=false}})
</script>
<style scoped>
.env-panel{display:grid;grid-template-columns:220px 1fr;gap:14px;min-height:390px;font-size:12px}.env-files{display:grid;align-content:start;gap:5px;overflow:auto}.env-files button{text-align:left;padding:8px;border:1px solid var(--pqt-border);border-radius:6px;color:var(--pqt-text-muted);background:transparent;font:10px var(--pqt-font-mono);cursor:pointer;word-break:break-all}.env-files button.active{color:var(--pqt-text);border-color:var(--pqt-accent);background:#1b3536}.env-editor{display:grid;grid-template-rows:auto 1fr auto;gap:8px;min-width:0}.env-editor-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.env-editor-head code{overflow:hidden;text-overflow:ellipsis;color:var(--pqt-text-muted);font-size:10px}.env-editor textarea{min-height:330px;width:100%;resize:none;padding:12px;color:var(--pqt-text);background:var(--pqt-canvas);border:1px solid var(--pqt-border-strong);border-radius:7px;font:11px/1.5 var(--pqt-font-mono)}
</style>
