import { reactive } from 'vue'
import IPC from '@/util/IPC'
import { showNotice } from './app'
type Snapshot={content:string;digest:string}
const state=reactive({content:'',digest:'',loading:false,saving:false,error:''})
const request=(method:string,...args:string[])=>new Promise<any>((resolve,reject)=>{IPC.send('App-Node-FN','host',method,...args).then((key:string,response:any)=>{IPC.off(key);if(response?.code===0)resolve(response.data);else reject(new Error(response?.msg??'Hosts operation failed'))})})
const load=async()=>{state.loading=true;state.error='';try{const data=await request('readHosts') as Snapshot;state.content=data.content;state.digest=data.digest;return true}catch(e){state.error=e instanceof Error?e.message:String(e);showNotice(state.error);return false}finally{state.loading=false}}
const save=async()=>{if(state.saving||!state.digest)return false;state.saving=true;try{await request('replaceHosts',state.content,state.digest);showNotice('Hosts file saved');await load();return true}catch(e){state.error=e instanceof Error?e.message:String(e);showNotice(state.error);return false}finally{state.saving=false}}
export const hostsController={state,load,save}
