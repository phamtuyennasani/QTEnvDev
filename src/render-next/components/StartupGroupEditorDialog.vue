<template>
  <div v-if="open" class="forge-modal-backdrop" @click.self="close">
    <section class="forge-modal startup-editor" role="dialog" aria-modal="true">
      <header class="forge-modal-header"><div><p class="eyebrow">STARTUP GROUP</p><h2>{{ group ? 'Edit group' : 'New group' }}</h2></div><button class="icon-button" @click="close">×</button></header>
      <div class="startup-editor-body">
        <label>Name<input v-model="draft.name" maxlength="64" /></label>
        <label>Description<textarea v-model="draft.description" rows="2" /></label>
        <label class="check-row"><input v-model="draft.continueOnFailure" type="checkbox" /> Continue when a member fails</label>
        <div class="editor-columns"><div><p class="eyebrow">AVAILABLE TARGETS</p><div v-if="loading" class="muted">Loading candidates…</div><button v-for="candidate in candidates" :key="candidate.key" class="candidate-row" :class="{selected: selected.has(candidate.key)}" @click="toggle(candidate)"><span>{{ selected.has(candidate.key) ? '✓' : '+' }}</span><span><b>{{ candidate.displayName || candidate.label }}</b><small>{{ candidate.displayPath }}</small></span></button></div><div><p class="eyebrow">START ORDER</p><div v-if="!draft.items.length" class="muted">Select targets to build the order.</div><div v-for="(item,index) in draft.items" :key="item.id" class="order-row"><span>{{ index + 1 }}</span><span>{{ label(item) }}</span><button @click="move(index,-1)" :disabled="index===0">↑</button><button @click="move(index,1)" :disabled="index===draft.items.length-1">↓</button></div></div></div>
      </div><footer class="forge-modal-footer"><button class="action-button" @click="close">Cancel</button><button class="action-button action-button--primary" :disabled="saving || !draft.name.trim()" @click="save">{{ saving ? 'Saving…' : 'Save group' }}</button></footer>
    </section>
  </div>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { StartupGroupManager } from '@/components/StartupGroup/class/StartupGroupManager'
import { StartupGroup } from '@/components/StartupGroup/class/StartupGroup'
import type { StartupGroupCandidateData, StartupGroupDraft, StartupGroupItem } from '@/components/StartupGroup/type'
const props = defineProps<{ open:boolean; group?: any }>()
const emit = defineEmits<{ 'update:open':[boolean]; saved:[] }>()
const loading=ref(false), saving=ref(false), candidates=ref<StartupGroupCandidateData[]>([]), selected=ref(new Set<string>())
const draft=ref<StartupGroupDraft>({name:'',description:'',color:'#20d4c8',continueOnFailure:false,items:[]})
const close=()=>emit('update:open',false)
const label=(item:StartupGroupItem)=>item.type==='service-version'?`${item.module} · ${item.versionBin}`:`${item.module} · ${item.projectPath}`
const load=async()=>{ loading.value=true; try { candidates.value=await StartupGroupManager.runtime.listCandidates(); const items=props.group?.items??[]; draft.value={name:props.group?.name??'',description:props.group?.description??'',color:props.group?.color??'#20d4c8',continueOnFailure:!!props.group?.continueOnFailure,items:items.map((x:StartupGroupItem)=>({...x}))}; selected.value=new Set(draft.value.items.map(StartupGroup.itemKey)) } finally { loading.value=false } }
watch(()=>props.open,(v)=>{if(v) void load()})
const toggle=(candidate:StartupGroupCandidateData)=>{ const next=new Set(selected.value); if(next.has(candidate.key)){next.delete(candidate.key); draft.value.items=draft.value.items.filter(x=>StartupGroup.itemKey(x)!==candidate.key)} else {next.add(candidate.key); draft.value.items.push({...candidate.item})}; selected.value=next }
const move=(i:number,d:number)=>{const j=i+d;if(j<0||j>=draft.value.items.length)return;const a=draft.value.items[i];draft.value.items.splice(i,1);draft.value.items.splice(j,0,a)}
const save=async()=>{if(!draft.value.name.trim())return;saving.value=true;try{if(props.group) await StartupGroupManager.store.update(props.group.id,draft.value);else await StartupGroupManager.store.add(draft.value);emit('saved');close()}catch(e){alert(e instanceof Error?e.message:String(e))}finally{saving.value=false}}
</script>
