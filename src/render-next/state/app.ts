import { reactive } from 'vue'

export type Workspace = 'overview' | 'websites' | 'services' | 'runtimes' | 'databases' | 'startup-groups' | 'custom-modules' | 'tools' | 'logs' | 'cron' | 'http-serve' | 'dns-server' | 'ftp-accounts' | 'podman' | 'settings'

export const nextAppState = reactive({
  workspace: 'overview' as Workspace,
  operation: 'Workspace ready',
  toast: '',
  dialog: undefined as { title: string; message: string; progress?: number } | undefined,
  cronWebsite: undefined as { id: number; name: string; root: string } | undefined
})

export const navigateNext = (workspace: Workspace, cronWebsite?: { id: number; name: string; root: string }) => {
  nextAppState.cronWebsite = workspace === 'cron' ? cronWebsite : undefined
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

