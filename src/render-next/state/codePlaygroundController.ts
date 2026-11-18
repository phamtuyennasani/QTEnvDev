import { reactive } from 'vue'
import IPC from '@/util/IPC'
const state=reactive({language:'javascript',code:'console.log("Hello from PQT Forge")',output:'',running:false,error:''})
const run=async()=>{if(state.running||!state.code.trim())return false;state.running=true;state.error='';try{await new Promise<void>((resolve,reject)=>{IPC.send('app-fork:code','codeRun',state.code,state.language,'').then((key:string,res:any)=>{IPC.off(key);if(res?.code===0){state.output=String(res.data??'');resolve()}else reject(new Error(res?.msg??'Execution failed'))})});return true}catch(e){state.error=e instanceof Error?e.message:String(e);return false}finally{state.running=false}}
const clear=()=>{state.output='';state.error=''}
export const codePlaygroundController={state,run,clear}
