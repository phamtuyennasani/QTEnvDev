<template>
  <section class="screen websites-screen">
    <header class="page-header"><div><p class="eyebrow">WORKSPACE / WEBSITES</p><h1>Websites</h1><p class="subtitle">Local hosts, runtime configuration and project files.</p></div><button class="primary-button" :disabled="busy" @click="openEditor()">＋ New website</button></header>
    <div class="website-toolbar"><label class="search-box"><span>⌕</span><input v-model="query" placeholder="Search projects or domains" /></label><label class="website-sort">Sort<select v-model="sort"><option value="name">Name</option><option value="domain">Domain</option><option value="runtime">Runtime</option><option value="ssl">SSL state</option></select></label><button class="action-button" @click="templatesOpen = true">Vhost templates</button><button class="action-button" :disabled="projectController.loading || busy" @click="projectController.refresh()">{{ projectController.loading ? 'Refreshing…' : 'Refresh' }}</button></div>
    <p v-if="projectController.error && !editorOpen" class="forge-alert forge-alert--error" role="alert">{{ projectController.error }}</p>
    <div v-if="projectController.operation" class="forge-alert" role="status"><b>{{ projectController.operation.message }}</b><p v-for="warning in projectController.operation.warnings" :key="warning">{{ warning }}</p></div>
    <div class="websites-layout">
      <article class="panel project-list-panel"><button v-for="project in filteredProjects" :key="project.id" class="project-item" :class="{ selected: selectedProject?.id === project.id }" @click="projectController.select(project)"><span class="project-icon">⌁</span><span class="project-copy"><b>{{ project.name }}</b><small>{{ project.domain }}</small></span><span class="project-state">{{ project.ssl ? 'HTTPS' : 'HTTP' }}</span></button><p v-if="!filteredProjects.length" class="empty-copy">{{ projectController.loading ? 'Loading saved websites…' : query ? 'No websites match this search.' : 'No websites yet. Create a local website to get started.' }}</p></article>
      <article v-if="selectedProject" class="panel project-detail-panel">
        <div class="detail-top"><div><p class="eyebrow">WEBSITE DETAIL</p><h2>{{ selectedProject.name }}</h2><p class="detail-kind">{{ selectedProject.domain }}</p></div><span class="project-badge">Saved</span></div>
        <div class="project-facts"><div><span>Root path</span><code :title="selectedProject.path">{{ selectedProject.path }}</code></div><div><span>Runtime</span><b>{{ selectedProject.runtime }}</b></div><div><span>HTTPS</span><b>{{ selectedProject.ssl ? 'Configured' : 'Disabled' }}</b></div><div><span>Open using</span><select v-model="server" aria-label="Web server endpoint"><option v-for="item in servers" :key="item.flag" :value="item.flag">{{ item.label }} :{{ selectedProject.host.port[(selectedProject.ssl ? item.flag + '_ssl' : item.flag) as keyof WebsiteHost['port']] }}</option></select></div></div>
        <div class="detail-actions"><button class="action-button action-button--primary" @click="openProject">Open site ↗</button><button class="action-button" @click="qrProject = selectedProject">QR code</button><button class="action-button" :disabled="!editableWebsite(selectedProject.host) || busy" @click="openEditor(selectedProject.host)">Configure</button></div>
        <p v-if="!editableWebsite(selectedProject.host)" class="website-help">This {{ selectedProject.host.type }} project is retained. Its dedicated runtime editor is pending migration.</p>
        <div class="website-secondary-actions"><button class="text-button" @click="projectController.reveal(selectedProject.path)">Show root folder ↗</button><button class="text-button" @click="logsProject = selectedProject">Host log files ↗</button><button class="text-button" @click="vhostsProject = selectedProject">Vhost / rewrite files ↗</button><button class="text-button website-danger" :disabled="busy" @click="pendingDelete = selectedProject; confirmation = ''">Remove website</button></div>
      </article>
    </div>
    <ProjectWorkflowPanel />
    <WebsiteEditor v-if="editorOpen" :original="editing" @close="editorOpen = false" />
    <TomcatWebsiteEditor v-if="tomcatEditorOpen" :original="editing" @close="tomcatEditorOpen = false" @saved="projectController.refresh()" />
    <ForgeDialog v-if="pendingDelete" title="Remove website?" description="Remove the host record, generated server configuration and managed certificate. Your project directory and source files are kept." @close="pendingDelete = undefined">
      <div class="website-form"><label>Type {{ pendingDelete.domain }} to confirm<input v-model="confirmation" autofocus autocomplete="off" @keyup.enter="remove" /></label><p v-if="projectController.error" class="forge-alert forge-alert--error" role="alert">{{ projectController.error }}</p></div>
      <template #footer><button class="action-button" @click="pendingDelete = undefined">Cancel</button><button class="action-button action-button--danger" :disabled="busy || confirmation !== pendingDelete.domain" @click="remove">Remove configuration</button></template>
    </ForgeDialog>
    <ForgeDialog v-if="logsProject" :title="logsProject.domain + ' · logs'" description="Reveal the generated log files in your file manager. Files appear after the corresponding web server handles requests." @close="logsProject = undefined">
      <div class="website-log-files"><button v-for="file in projectController.logs(logsProject)" :key="file.path" class="action-button" @click="projectController.reveal(file.path)"><b>{{ file.label }}</b><code>{{ file.path }}</code><span>↗</span></button></div>
    </ForgeDialog>
    <ForgeDialog v-if="vhostsProject" :title="vhostsProject.domain + ' · vhost files'" description="Reveal generated server configuration and rewrite files. Missing files are reported explicitly." @close="vhostsProject = undefined">
      <div class="website-log-files"><button v-for="file in projectController.vhosts(vhostsProject)" :key="file.path" class="action-button" @click="projectController.reveal(file.path)"><b>{{ file.label }}</b><code>{{ file.path }}</code><span>↗</span></button></div>
    </ForgeDialog>
    <QrCodePanel v-if="qrProject" :initial-value="websiteUrl(qrProject.host, server)" @close="qrProject = undefined" />
    <VhostTemplatePanel v-if="templatesOpen" @close="templatesOpen = false" />
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { projectController, type ProjectItem } from '../state/projectController'
import WebsiteEditor from '../websites/WebsiteEditor.vue'
import TomcatWebsiteEditor from '../websites/TomcatWebsiteEditor.vue'
import ForgeDialog from '../components/ForgeDialog.vue'
import { editableWebsite } from '../websites/model'
import type { WebsiteHost } from '../websites/types'
import ProjectWorkflowPanel from '../components/ProjectWorkflowPanel.vue'
import QrCodePanel from '../components/QrCodePanel.vue'
import { websiteUrl } from '../websites/model'
import VhostTemplatePanel from '../components/VhostTemplatePanel.vue'
const query = ref(''); const sort = ref<'name'|'domain'|'runtime'|'ssl'>('name')
const selectedProject = computed(() => projectController.selected.project)
const filteredProjects = computed(() => projectController.projects.filter((item) => (item.name + ' ' + item.domain).toLowerCase().includes(query.value.toLowerCase())).slice().sort((a,b) => { const av = sort.value === 'ssl' ? Number(a.ssl) : String(a[sort.value]); const bv = sort.value === 'ssl' ? Number(b.ssl) : String(b[sort.value]); return av < bv ? -1 : av > bv ? 1 : 0 }))
const busy = computed(() => projectController.saving)
const editorOpen = ref(false); const tomcatEditorOpen = ref(false); const editing = ref<WebsiteHost>()
const pendingDelete = ref<ProjectItem>(); const confirmation = ref(''); const logsProject = ref<ProjectItem>(); const vhostsProject = ref<ProjectItem>(); const qrProject = ref<ProjectItem>(); const templatesOpen = ref(false)
const server = ref<'nginx' | 'apache' | 'caddy' | 'frankenphp' | 'tomcat'>('nginx')
const servers = [{ flag: 'nginx', label: 'Nginx' }, { flag: 'apache', label: 'Apache' }, { flag: 'caddy', label: 'Caddy' }, { flag: 'frankenphp', label: 'FrankenPHP' }, { flag: 'tomcat', label: 'Tomcat' }] as const
const openEditor = (host?: WebsiteHost) => { projectController.error = ''; editing.value = host; if (host && !editableWebsite(host)) return; if (host?.type === 'tomcat' || host?.subType === 'other') { tomcatEditorOpen.value = true; return } editorOpen.value = true }
const openProject = () => { if (selectedProject.value) void projectController.open(selectedProject.value, server.value) }
const remove = async () => { if (pendingDelete.value && await projectController.remove(pendingDelete.value, confirmation.value)) pendingDelete.value = undefined }
onMounted(() => { void projectController.refresh() })
</script>
