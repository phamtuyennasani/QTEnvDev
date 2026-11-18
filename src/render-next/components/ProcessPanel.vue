<template>
  <ForgeDialog title="Process control" description="Find processes holding a port or matching a command, then stop selected PIDs." eyebrow="WORKSPACE / SYSTEM" wide @close="emit('close')">
    <div class="process-panel"><div class="process-tabs"><button :class="{active:kind==='port'}" @click="kind='port';clear()">Port</button><button :class="{active:kind==='process'}" @click="kind='process';clear()">Process name</button></div><div class="process-search"><input v-model="query" :placeholder="kind==='port'?'e.g. 8080':'e.g. node'" @keyup.enter="search" /><button class="primary-button" :disabled="!query.trim()||loading" @click="search">{{loading?'Searching…':'Search'}}</button></div><p v-if="error" class="forge-alert forge-alert--error">{{ error }}</p><div v-if="rows.length" class="process-list"><label v-for="row in rows" :key="row.PID" class="process-row"><input v-model="selected" type="checkbox" :value="row.PID" /><span><b>{{ row.COMMAND || 'Unknown command' }}</b><small>PID {{ row.PID }} · PPID {{ row.PPID || '—' }} · {{ row.USER || 'user' }}</small></span></label></div><p v-else class="empty-copy">{{ query ? 'No matching processes.' : 'Search for a port or process name.' }}</p></div>
    <template #footer><span class="website-help">Stopping a process is immediate and may interrupt active work.</span><button class="action-button action-button--danger" :disabled="!selected.length||killing" @click="kill">{{ killing?'Stopping…':'Stop selected' }}</button></template>
  </ForgeDialog>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import ForgeDialog from './ForgeDialog.vue'
import IPC from '@/util/IPC'
const emit=defineEmits<{close:[]}>(); const kind=ref<'port'|'process'>('port'); const query=ref(''); const rows=ref<any[]>([]); const selected=ref<string[]>([]); const loading=ref(false); const killing=ref(false); const error=ref('')
const invoke=(method:string,...args:unknown[])=>new Promise<any>((resolve,reject)=>{IPC.send('app-fork:tools',method,...args).then((key:string,res:any)=>{IPC.off(key);res?.code===0?resolve(res.data):reject(new Error(res?.msg??'Process operation failed'))})})
const clear=()=>{rows.value=[];selected.value=[];error.value=''}; watch(kind,clear)
const search=async()=>{loading.value=true;error.value='';selected.value=[];try{rows.value=await invoke(kind.value==='port'?'getPortPids':'getPidsByKey',query.value.trim())??[]}catch(e){error.value=e instanceof Error?e.message:String(e)}finally{loading.value=false}}
const kill=async()=>{killing.value=true;error.value='';try{await invoke('killPids','-9',selected.value);await search()}catch(e){error.value=e instanceof Error?e.message:String(e)}finally{killing.value=false}}
</script>
<style scoped>
.process-panel{display:grid;gap:14px;font-size:12px}.process-tabs{display:flex;gap:6px}.process-tabs button{padding:7px 11px;border:1px solid var(--pqt-border);border-radius:6px;color:var(--pqt-text-muted);background:transparent;cursor:pointer}.process-tabs button.active{color:var(--pqt-text);border-color:var(--pqt-accent);background:#1b3536}.process-search{display:flex;gap:8px}.process-search input{flex:1;padding:9px 10px;color:var(--pqt-text);background:var(--pqt-canvas);border:1px solid var(--pqt-border-strong);border-radius:7px;font:12px var(--pqt-font-mono)}.process-list{display:grid;gap:5px;max-height:280px;overflow:auto}.process-row{display:flex;gap:10px;align-items:center;padding:9px;border:1px solid var(--pqt-border);border-radius:7px}.process-row span{display:grid;gap:3px}.process-row small{color:var(--pqt-text-muted);font:10px var(--pqt-font-mono)}
</style>
