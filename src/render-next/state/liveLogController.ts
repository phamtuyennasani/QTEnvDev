import { reactive } from 'vue'
import { fs, shell } from '@/util/NodeFn'
import { showNotice } from './app'
const state=reactive({path:'',content:'',loading:false,error:'',watching:false})
let timer:number|undefined
const read=async()=>{if(!state.path||state.loading)return false;state.loading=true;state.error='';try{state.content=await fs.readFileStrict(state.path);return true}catch(e){state.error=e instanceof Error?e.message:String(e);return false}finally{state.loading=false}}
const start=()=>{stop();state.watching=true;void read();timer=window.setInterval(()=>void read(),1500)}
const stop=()=>{if(timer)window.clearInterval(timer);timer=undefined;state.watching=false}
const clear=async()=>{if(!state.path)return false;try{await fs.writeFile(state.path,'');state.content='';showNotice('Log file cleared');return true}catch(e){state.error=e instanceof Error?e.message:String(e);return false}}
const reveal=()=>{if(state.path)shell.showItemInFolder(state.path).catch(()=>{})}
export const liveLogController={state,read,start,stop,clear,reveal}
