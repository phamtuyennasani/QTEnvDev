import { reactive } from 'vue'
import { ProjectSetup } from '@/components/LanguageProjects/setup'
import type { ProjectItem } from '@/components/LanguageProjects/ProjectItem'
import { showNotice } from './app'
const state=reactive({projects:[] as ProjectItem[],loading:false,busy:false,error:'',query:''})
const load=async()=>{state.loading=true;state.error='';try{const source=ProjectSetup('php');await source.fetchProject();state.projects.splice(0,state.projects.length,...source.project);return true}catch(e){state.error=e instanceof Error?e.message:String(e);showNotice(state.error);return false}finally{state.loading=false}}
const run = async (project: ProjectItem, enabled: boolean) => {
  if (state.busy) return false
  state.busy = true
  state.error = ''
  try {
    const result = enabled ? await project.start() : await project.stop()
    if (result !== true) {
      throw new Error(typeof result === 'string' ? result : 'The project did not confirm the requested action.')
    }
    return true
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error)
    showNotice(state.error)
    return false
  } finally {
    state.busy = false
  }
}
export const phpProjectsController={state,load,run,filtered:()=>state.projects.filter((project)=>`${project.comment} ${project.path}`.toLowerCase().includes(state.query.toLowerCase()))}
