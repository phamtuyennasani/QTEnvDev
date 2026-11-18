import { reactive } from 'vue'
import type { CronJob } from '@shared/app'
import IPC from '@/util/IPC'
import { showNotice } from './app'
const state=reactive({jobs:[] as CronJob[],loading:false,busy:false,error:''})
const request=(method:string,...args:unknown[])=>new Promise<any>((resolve,reject)=>{IPC.send('app-fork:cron',method,...args).then((key:string,res:any)=>{IPC.off(key);if(res?.code===0)resolve(res.data);else reject(new Error(res?.msg??`${method} failed`))})})
const load=async()=>{state.loading=true;state.error='';try{state.jobs.splice(0,state.jobs.length,...(await request('getCronJobs') as CronJob[]));return true}catch(e){state.error=e instanceof Error?e.message:String(e);showNotice(state.error);return false}finally{state.loading=false}}
const mutate=async(fn:()=>Promise<any>)=>{if(state.busy)return false;state.busy=true;try{await fn();await load();return true}catch(e){state.error=e instanceof Error?e.message:String(e);showNotice(state.error);return false}finally{state.busy=false}}
const toggle=(job:CronJob)=>mutate(()=>request('toggleCronJob',job.hostId??0,job.id,!job.enabled))
const run=(job:CronJob)=>mutate(()=>request('runJobNow',job.hostId??0,job.id,job.workDir??''))
const remove=(job:CronJob)=>mutate(()=>request('deleteCronJob',job.hostId??0,job.id))
const save=(draft:Partial<CronJob>, existing?:CronJob)=>{const schedule=String(draft.schedule??'').trim();if(schedule.split(/\s+/).length!==5){state.error='Schedule must contain five cron fields.';showNotice(state.error);return Promise.resolve(false)}if(!draft.name?.trim()||!draft.command?.trim()){state.error='Name and command are required.';showNotice(state.error);return Promise.resolve(false)}if(draft.scope==='host'&&!draft.hostId){state.error='Choose a website before saving a website task.';showNotice(state.error);return Promise.resolve(false)}return mutate(()=>existing?request('updateCronJob',existing.hostId??0,existing.id,{...draft,schedule}):request('addCronJob',draft.hostId??0,{...draft,schedule}))}
export const cronController={state,load,toggle,run,remove,save}
