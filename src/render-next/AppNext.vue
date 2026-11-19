<template>
  <div class="pqt-app" @keydown.esc="closeTask">
    <header class="titlebar">
      <div class="brand"><span class="brand-mark"><PqtMark :size="18" color="var(--pqt-accent)" /></span><span>PQT Forge</span></div>
      <span class="titlebar-context">Developer Environment</span>
      <div class="window-controls"><button aria-label="Minimize" @click="windowCommand('Application:APP-Minimize')">−</button><button class="close" aria-label="Close" @click="windowCommand('Application:APP-Close')">×</button></div>
    </header>
    <div class="app-body">
      <aside class="sidebar">
        <div class="sidebar-section"><p class="sidebar-label">WORKSPACE</p><button v-for="item in navigation" :key="item.id" class="nav-item" :class="{ active: nextAppState.workspace === item.id }" @click="navigateNext(item.id)"><span class="nav-icon">{{ item.icon }}</span><span>{{ item.label }}</span><kbd v-if="item.shortcut">{{ item.shortcut }}</kbd></button></div>
        <div class="sidebar-bottom"><button class="nav-item" :class="{ active: nextAppState.workspace === 'settings' }" @click="navigateNext('settings')"><span class="nav-icon">⚙</span><span>Settings</span></button><div class="profile-chip"><span class="profile-avatar">PQT</span><span><b>PQT Forge</b><small>Local workspace</small></span></div></div>
      </aside>
      <main class="main">
        <OverviewScreen v-if="nextAppState.workspace === 'overview'" />
        <WebsitesScreen v-else-if="nextAppState.workspace === 'websites'" />
        <ServicesScreen v-else-if="nextAppState.workspace === 'services'" />
        <RuntimesScreen v-else-if="nextAppState.workspace === 'runtimes'" />
        <DatabasesScreen v-else-if="nextAppState.workspace === 'databases'" />
        <StartupGroupsScreen v-else-if="nextAppState.workspace === 'startup-groups'" />
        <CustomModulesScreen v-else-if="nextAppState.workspace === 'custom-modules'" />
        <ToolsScreen v-else-if="nextAppState.workspace === 'tools'" />
        <LogsScreen v-else-if="nextAppState.workspace === 'logs'" />
        <CronScreen v-else-if="nextAppState.workspace === 'cron'" />
        <HttpServeScreen v-else-if="nextAppState.workspace === 'http-serve'" />
        <DnsServerScreen v-else-if="nextAppState.workspace === 'dns-server'" />
        <FtpAccountsScreen v-else-if="nextAppState.workspace === 'ftp-accounts'" />
        <PodmanScreen v-else-if="nextAppState.workspace === 'podman'" />
        <SettingsScreen v-else-if="nextAppState.workspace === 'settings'" />
      </main>
    </div>
    <footer class="statusbar"><span>{{ nextAppState.operation }}</span><span class="mono">PQT FORGE / 1.0.0</span></footer>
    <NoticeRail />
    <TaskDialog />
    <CommandPalette ref="commandPalette" />
  <DatabaseManagePanel v-if="activeDatabaseManager" :item="activeDatabaseManager.item" :component="activeDatabaseManager.component" @close="databaseManageController.close()" />
  </div>
</template>
<script setup lang="ts">
import PqtMark from './icons/PqtMark.vue'
import OverviewScreen from './screens/OverviewScreen.vue'
import ServicesScreen from './screens/ServicesScreen.vue'
import WebsitesScreen from './screens/WebsitesScreen.vue'
import RuntimesScreen from './screens/RuntimesScreen.vue'
import DatabasesScreen from './screens/DatabasesScreen.vue'
import DatabaseManagePanel from './components/DatabaseManagePanel.vue'
import { databaseManageController } from './state/databaseManageController'
import StartupGroupsScreen from './screens/StartupGroupsScreen.vue'
import ToolsScreen from './screens/ToolsScreen.vue'
import SettingsScreen from './screens/SettingsScreen.vue'
import LogsScreen from './screens/LogsScreen.vue'
import CronScreen from './screens/CronScreen.vue'
import HttpServeScreen from './screens/HttpServeScreen.vue'
import DnsServerScreen from './screens/DnsServerScreen.vue'
const activeDatabaseManager = databaseManageController.active
import CommandPalette from './components/CommandPalette.vue'
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watchEffect } from 'vue'
import NoticeRail from './components/NoticeRail.vue'
import TaskDialog from './components/TaskDialog.vue'
import { nextAppState, navigateNext, closeTask, type Workspace } from './state/app'
import { startLogListener } from './state/logController'
import { serviceController } from './state/serviceController'
import { databaseController } from './state/databaseController'
import { runtimeController } from './state/runtimeController'
import { useWorkspaceAppearance } from './state/workspaceAppearance'
import { isWorkspaceVisible } from './moduleVisibility/workspaces'
import IPC from '@/util/IPC'
useWorkspaceAppearance()
const PodmanScreen = defineAsyncComponent(() => import('./screens/PodmanScreen.vue'))
const CustomModulesScreen = defineAsyncComponent(() => import('./screens/CustomModulesScreen.vue'))
const FtpAccountsScreen = defineAsyncComponent(() => import('./screens/FtpAccountsScreen.vue'))
const windowCommand = (command: 'Application:APP-Minimize' | 'Application:APP-Maximize' | 'Application:APP-Close') => IPC.send(command)

window.addEventListener('pqt-notice', (event) => {
  const message = (event as CustomEvent<string>).detail
  nextAppState.toast = message
  window.setTimeout(() => { if (nextAppState.toast === message) nextAppState.toast = '' }, 2600)
})
const commandPalette = ref<InstanceType<typeof CommandPalette>>()
const onShortcut = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); commandPalette.value?.show(); return }
  if (event.metaKey || event.ctrlKey || event.altKey || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
  const shortcut = navigation.value.find((item) => item.shortcut === event.key)
  if (shortcut) navigateNext(shortcut.id)
}
onMounted(() => window.addEventListener('keydown', onShortcut))
onMounted(() => startLogListener())
const refreshPackages = () => {
  const workspace = nextAppState.workspace
  if (workspace === 'services' || workspace === 'overview') void serviceController.refresh()
  if (workspace === 'databases') void databaseController.refresh()
  if (workspace === 'runtimes') void runtimeController.refresh()
}
onMounted(() => window.addEventListener('pqt-packages-changed', refreshPackages))
onUnmounted(() => {
  window.removeEventListener('keydown', onShortcut)
  window.removeEventListener('pqt-packages-changed', refreshPackages)
})
const workspaces: { id: Workspace; label: string; icon: string; shortcut?: string }[] = [
  { id: 'overview', label: 'Overview', icon: '⌂', shortcut: '1' },
  { id: 'websites', label: 'Websites', icon: '⌁', shortcut: '2' },
  { id: 'services', label: 'Services', icon: '◉', shortcut: '3' },
  { id: 'runtimes', label: 'Runtimes', icon: '⌘' },
  { id: 'databases', label: 'Databases', icon: '◈' },
  { id: 'startup-groups', label: 'Startup groups', icon: '▶' },
  { id: 'custom-modules', label: 'Custom modules', icon: '⊞' },
  { id: 'tools', label: 'Tools', icon: '✦' },
  { id: 'logs', label: 'Logs', icon: '≋' },
  { id: 'cron', label: 'Scheduled tasks', icon: '◷' }
]
const navigation = computed(() => workspaces.filter((item) => isWorkspaceVisible(item.id)))
watchEffect(() => {
  if (!isWorkspaceVisible(nextAppState.workspace)) navigateNext('overview')
})
</script>
<style src="./styles/app.css"></style>
<style src="./styles/services.css"></style>
<style src="./styles/websites.css"></style>
<style src="./styles/runtimes-databases.css"></style>
<style src="./styles/tools.css"></style>
<style src="./styles/settings-command.css"></style>
<style src="./styles/logs.css"></style>
<style src="./styles/startup-groups.css"></style>
<style>
.header-actions { display:flex; gap:8px; align-items:center }
.service-files { display:grid; grid-template-columns:220px 1fr; gap:14px; min-height:330px }
.service-file-list { border-right:1px solid var(--pqt-border); padding-right:10px; overflow:auto }
.service-file-item { display:block; width:100%; padding:9px; border:0; border-bottom:1px solid var(--pqt-border); color:var(--pqt-text); background:transparent; text-align:left; cursor:pointer }
.service-file-item.selected { background:var(--pqt-surface-hover); color:var(--pqt-accent) }
.service-file-item span,.service-file-item small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.service-file-item small { margin-top:3px; color:var(--pqt-text-muted); font:9px var(--pqt-font-mono) }
.service-file-editor { min-width:0; display:flex; flex-direction:column; gap:10px }
.service-file-toolbar { display:flex; align-items:center; gap:8px }
.service-file-toolbar code { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.service-file-editor textarea,.service-log-preview { flex:1; min-height:280px; width:100%; resize:none; padding:10px; border:1px solid var(--pqt-border); border-radius:7px; color:var(--pqt-text); background:var(--pqt-field); font:10px/1.5 var(--pqt-font-mono); white-space:pre-wrap; overflow:auto }
</style>


