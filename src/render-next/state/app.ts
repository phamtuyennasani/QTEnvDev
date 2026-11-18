import { reactive } from 'vue'

export type Workspace = 'overview' | 'websites' | 'services' | 'runtimes' | 'databases' | 'startup-groups' | 'tools' | 'logs' | 'cron' | 'settings'

export const nextAppState = reactive({
  workspace: 'overview' as Workspace,
  operation: 'All systems operational',
  toast: '',
  dialog: undefined as { title: string; message: string; progress?: number } | undefined
})

export const navigateNext = (workspace: Workspace) => {
  nextAppState.workspace = workspace
}

export const showNotice = (message: string) => {
  nextAppState.toast = message
  window.setTimeout(() => {
    if (nextAppState.toast === message) nextAppState.toast = ''
  }, 2600)
}

export const showTask = (title: string, message: string, progress = 0) => {
  nextAppState.dialog = { title, message, progress }
}

export const closeTask = () => {
  nextAppState.dialog = undefined
}

