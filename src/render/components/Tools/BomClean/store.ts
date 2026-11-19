import { ref, Ref } from 'vue'
import { bomScan, bomClean } from './Operation'
import { MessageError } from '@/util/Element'
export type Ext = {
  ext: string
  count: number
}
export type BomCleanStore = {
  path: string
  files: Array<string>
  exclude: string
  allExt: Array<Ext>
  allowExt: Array<string>
  loading: boolean
  running: boolean
  end: boolean
  progress: {
    count: number
    finish: number
    fail: number
    failTask: Array<any>
    success: number
    successTask: Array<any>
  }
}
const store: Ref<BomCleanStore> = ref({
  path: '',
  files: [],
  exclude: `.idea
.git
.svn
.vscode
node_modules`,
  allExt: [],
  allowExt: [],
  running: false,
  end: false,
  loading: false,
  progress: {
    count: 0,
    finish: 0,
    fail: 0,
    failTask: [],
    success: 0,
    successTask: []
  }
})
export default store
export function scanBomFiles() {
  if (store.value.loading || (store.value.running && !store.value.end)) return
  store.value.loading = true
  return bomScan.run('app-fork:tools', ['getAllFile', store.value.path], (data) => { store.value.files = Array.isArray(data) ? data : [] }).then((done) => { store.value.loading = false; if (!done) MessageError(bomScan.error) })
}
export function cleanBomFiles(files: string[]) {
  if (store.value.loading || (store.value.running && !store.value.end)) return
  store.value.running = true
  return bomClean.run('app-fork:tools', ['cleanBom', [...files]], () => undefined, (progress) => { Object.assign(store.value.progress, progress ?? {}) }).then((done) => { store.value.end = true; store.value.running = false; if (!done) MessageError(bomClean.error) })
}
