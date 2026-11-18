import { reactive } from 'vue'
import IPC from '@/util/IPC'
import { showNotice } from './app'
export type TimingMetric={Metric:string;Value:string|number}
const state=reactive({url:'',list:[] as TimingMetric[],loading:false,error:''})
const fetch=async()=>{const url=state.url.trim();if(!url||state.loading)return false;try{new URL(url)}catch{state.error='Enter a valid URL';showNotice(state.error);return false}state.loading=true;state.error='';try{const data=await new Promise<TimingMetric[]>((resolve,reject)=>{IPC.send('app-fork:tools','requestTimeFetch',url).then((key:string,res:any)=>{IPC.off(key);if(res?.code===0)resolve(res.data??[]);else reject(new Error(res?.msg??'Request timing failed'))})});state.list.splice(0,state.list.length,...data);return true}catch(e){state.error=e instanceof Error?e.message:String(e);showNotice(state.error);return false}finally{state.loading=false}}
export const requestTimingController={state,fetch}
