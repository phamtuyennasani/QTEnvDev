import { computed, reactive } from 'vue'
import { StartupGroupManager } from '@/components/StartupGroup/class/StartupGroupManager'
import type { StartupGroup } from '@/components/StartupGroup/class/StartupGroup'
import { showNotice } from './app'

/** Renderer-lifetime bridge to the established startup-group domain. */
const state = reactive({ ready: false, loading: false, error: '' })
let initFlight: Promise<void> | undefined
const init = () => {
  if (initFlight) return initFlight
  state.loading = true
  state.error = ''
  initFlight = (async () => {
    try {
      await StartupGroupManager.store.init()
      state.ready = true
      await StartupGroupManager.ensureSources(StartupGroupManager.store.groups)
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error)
    } finally {
      state.loading = false
      initFlight = undefined
    }
  })()
  return initFlight
}
const groups = computed(() => StartupGroupManager.store.groups)
const defaultGroup = computed(() => StartupGroupManager.store.defaultGroup)
const isRunning = (group: StartupGroup) => StartupGroupManager.isGroupRunning(group)
const isExecuting = (group: StartupGroup) => StartupGroupManager.isGroupExecuting(group)
const run = async (group: StartupGroup, enabled: boolean, interactive = true) => {
  if (StartupGroupManager.busy) return false
  try {
    const result = await StartupGroupManager.setGroupEnabled(group, enabled, interactive)
    if (result) {
      const failed = result.members.filter((member) => ['failed', 'invalid'].includes(member.outcome)).length
      showNotice(`${group.name}: ${failed ? `${failed} member(s) failed` : enabled ? 'started' : 'stopped'}`)
    }
    return !result || !result.members.some((member) => ['failed', 'invalid'].includes(member.outcome))
  } catch (error) { showNotice(error instanceof Error ? error.message : String(error)); return false }
}
const runDefault = () => defaultGroup.value ? run(defaultGroup.value, true) : (showNotice('No default startup group is configured'), Promise.resolve(false))
const mutate = async (action: () => Promise<unknown>) => {
  if (StartupGroupManager.busy) return false
  try { await action(); return true }
  catch (error) { showNotice(error instanceof Error ? error.message : String(error)); return false }
}
const remove = (id: string) => mutate(() => StartupGroupManager.store.remove(id))
const setDefault = (id?: string) => mutate(() => StartupGroupManager.store.setDefault(id))
const reorder = (ids: string[]) => mutate(() => StartupGroupManager.store.reorder(ids))
export const startupGroupController = { state, groups, defaultGroup, ready: computed(() => state.ready), loading: computed(() => state.loading || StartupGroupManager.loading), busy: computed(() => StartupGroupManager.busy), error: computed(() => state.error), init, run, runDefault, isRunning, isExecuting, remove, setDefault, reorder, memberModuleLabel: StartupGroupManager.getMemberModuleLabel, memberTitle: StartupGroupManager.getMemberTitle, memberState: StartupGroupManager.getMemberState }
