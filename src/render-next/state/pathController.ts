import { reactive } from 'vue'
import IPC from '@/util/IPC'
import { showNotice } from './app'

export type PathEntry = { path: string; raw: string; error: boolean }
const state = reactive({ list: [] as PathEntry[], rawPath: '', loading: false, saving: false, error: '' })
const request = (method: string, ...args: unknown[]) => new Promise<any>((resolve, reject) => {
  IPC.send('app-fork:tools', method, ...args).then((key: string, response: any) => { IPC.off(key); if (response?.code === 0) resolve(response.data); else reject(new Error(response?.msg ?? `${method} failed`)) })
})
const load = async () => { state.loading=true; state.error=''; try { const data=await request('envPathList') as {rawPath:string;list:PathEntry[]}; state.rawPath=data.rawPath; state.list.splice(0,state.list.length,...data.list); return true } catch(e) {state.error=e instanceof Error?e.message:String(e);showNotice(state.error);return false} finally {state.loading=false} }
const add = (path:string) => { const value=path.trim(); if(value && !state.list.some((entry)=>entry.path===value)) state.list.push({path:value,raw:value,error:false}) }
const remove = (index:number) => { state.list.splice(index,1) }
const save = async () => { state.saving=true; try { await request('envPathUpdate',state.list.map((entry)=>entry.path),state.rawPath); showNotice('System PATH saved'); await load(); return true } catch(e) {state.error=e instanceof Error?e.message:String(e);showNotice(state.error);return false} finally {state.saving=false} }
export const pathController={state,load,add,remove,save}
