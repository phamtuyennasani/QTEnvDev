import { reactive, computed } from 'vue'
import { BrewStore } from '@/store/brew'
import IPC from '@/util/IPC'
import { shell } from '@/util/NodeFn'
import { showNotice } from './app'

type PhpState = { loading: boolean; iniPath: string; extensions: string[]; error: string }
const state = reactive<PhpState>({ loading: false, iniPath: '', extensions: [], error: '' })
const current = () => BrewStore().module('php').installed.find((item) => item.run) ?? BrewStore().currentVersion('php') ?? BrewStore().module('php').installed[0]
const request = <T>(method: string, ...args: unknown[]) => new Promise<T>((resolve, reject) => {
  IPC.send('app-fork:php', method, ...args).then((key: string, response: any) => {
    IPC.off(key)
    if (response?.code === 0) resolve(response.data as T)
    else reject(new Error(response?.msg ?? `${method} failed`))
  })
})
const load = async () => {
  const version = current(); if (!version) { state.error = 'PHP is not installed.'; return false }
  state.loading = true; state.error = ''
  try {
    state.iniPath = await request<string>('getIniPath', JSON.parse(JSON.stringify(version)))
    const rows = await request<Array<{ name?: string }>>('fetchLoadedExtensions', JSON.parse(JSON.stringify(version)))
    state.extensions = rows.map((row) => row.name ?? '').filter(Boolean)
    return true
  } catch (error) { state.error = error instanceof Error ? error.message : String(error); showNotice(state.error); return false }
  finally { state.loading = false }
}
const openFolder = () => { const version = current(); if (version) shell.openPath(version.path).catch(() => {}) }
export const phpController = { state, current, load, openFolder, installed: computed(() => Boolean(current())) }
