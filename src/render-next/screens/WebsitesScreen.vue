<template>
  <section class="screen websites-screen">
    <header class="page-header"
      ><div
        ><p class="eyebrow">WORKSPACE / WEBSITES</p><h1>Websites</h1
        ><p class="subtitle">Local hosts, runtime configuration and project files.</p></div
      ><div class="detail-actions"
        ><button class="action-button" :disabled="busy" @click="openTomcatEditor()"
          >New Tomcat website</button
        ><button class="primary-button" :disabled="busy" @click="openEditor()"
          >＋ New website</button
        ></div
      ></header
    >
    <div class="website-toolbar">
      <label class="search-box"
        ><span>⌕</span><input v-model="query" placeholder="Search projects or domains"
      /></label>
      <label class="website-sort"
        >Sort<select v-model="sort"
          ><option value="saved">Saved order</option
          ><option value="name">Name</option
          ><option value="domain">Domain</option
          ><option value="runtime">Runtime</option
          ><option value="ssl">SSL state</option></select
        ></label
      >
      <div class="detail-actions">
        <button class="action-button" @click="templatesOpen = true">Vhost templates</button>
        <button class="action-button" @click="backupOpen = true">Backup</button>
        <button class="action-button" @click="hostsOpen = true">System hosts</button>
        <button
          class="action-button"
          :disabled="projectController.loading || busy"
          @click="projectController.refresh()"
          >{{ projectController.loading ? 'Refreshing…' : 'Refresh' }}</button
        >
      </div>
    </div>
    <p
      v-if="projectController.error && !editorOpen && !tomcatEditorOpen"
      class="forge-alert forge-alert--error"
      role="alert"
      >{{ projectController.error }}</p
    >
    <div v-if="projectController.operation" class="forge-alert" role="status"
      ><b>{{ projectController.operation.message }}</b
      ><p v-for="warning in projectController.operation.warnings" :key="warning">{{
        warning
      }}</p></div
    >
    <div class="websites-layout">
      <article class="panel project-list-panel"
        ><button
          v-for="project in filteredProjects"
          :key="project.id"
          class="project-item"
          :class="{ selected: selectedProject?.id === project.id }"
          @click="projectController.select(project)"
          ><span class="project-icon">⌁</span
          ><span class="project-copy"
            ><b>{{ project.name }}</b
            ><small>{{ project.domain }}</small></span
          ><span class="project-state">{{ project.ssl ? 'HTTPS' : 'HTTP' }}</span></button
        ><p v-if="!filteredProjects.length" class="empty-copy">{{
          projectController.loading
            ? 'Loading saved websites…'
            : query
              ? 'No websites match this search.'
              : 'No websites yet. Create a local website to get started.'
        }}</p></article
      >
      <article v-if="selectedProject" class="panel project-detail-panel">
        <div class="detail-top"
          ><div
            ><h2>{{ selectedProject.name }}</h2
            ><p class="detail-kind">{{ selectedProject.domain }}</p></div
          ><span v-if="selectedProject.host.isTop" class="project-badge">Pinned</span></div
        >
        <div class="project-facts">
          <div
            ><span>Root path</span
            ><code :title="selectedProject.path">{{ selectedProject.path }}</code></div
          >
          <div
            ><span>Runtime</span><b>{{ selectedProject.runtime }}</b></div
          >
          <div
            ><span>HTTPS</span><b>{{ sslLabel(selectedProject.host) }}</b></div
          >
          <div
            v-if="isTomcatSite(selectedProject.host) || isDirectProjectSite(selectedProject.host)"
            ><span>Endpoint</span><code>{{ endpoint || 'Not configured' }}</code></div
          >
          <div v-else
            ><span>Open using</span
            ><select v-model="server" aria-label="Web server endpoint"
              ><option v-for="item in websiteServers" :key="item.flag" :value="item.flag"
                >{{ item.label }} :{{ websitePort(selectedProject.host, item.flag) }}</option
              ></select
            ></div
          >
        </div>
        <div class="detail-actions"
          ><button
            class="action-button action-button--primary"
            :disabled="!endpoint"
            @click="openProject"
            >Open site ↗</button
          ><button class="action-button" :disabled="!endpoint" @click="qrValue = endpoint"
            >QR code</button
          ><button
            class="action-button"
            :disabled="!editableWebsite(selectedProject.host) || busy"
            @click="openEditor(selectedProject.host)"
            >Configure</button
          ></div
        >
        <p v-if="!editableWebsite(selectedProject.host)" class="website-help"
          >This {{ selectedProject.host.type }} project is retained. Its dedicated runtime editor is
          pending migration.</p
        >
        <div class="website-secondary-actions"
          ><button class="text-button" @click="projectController.reveal(selectedProject.path)"
            >Show root folder ↗</button
          ><button class="text-button" @click="logsProject = selectedProject"
            >Host log files ↗</button
          ><button class="text-button" @click="vhostsProject = selectedProject"
            >Vhost / rewrite files ↗</button
          ><button
            class="text-button website-danger"
            :disabled="busy"
            @click="prepareRemoval(selectedProject)"
            >Remove website</button
          ></div
        >
        <div class="website-secondary-actions">
          <button class="text-button" @click="openScheduledTasks(selectedProject)"
            >Scheduled tasks ↗</button
          >
          <button class="text-button" @click="linksProject = selectedProject">Site links</button>
          <button
            v-if="!selectedProject.host.type || selectedProject.host.type === 'php'"
            class="text-button"
            :disabled="busy || projectController.loading"
            @click="pendingPark = selectedProject"
            >Add sites from subdirectories</button
          >
        </div>
        <div v-if="sort === 'saved'" class="website-secondary-actions">
          <button
            class="text-button"
            :disabled="busy || projectController.loading"
            @click="
              projectController.reorder(
                selectedProject,
                selectedProject.host.isTop ? 'unpin' : 'pin'
              )
            "
            >{{ selectedProject.host.isTop ? 'Unpin' : 'Pin' }}</button
          >
          <button
            class="text-button"
            :disabled="busy || projectController.loading || orderIndex <= 0"
            @click="projectController.reorder(selectedProject, 'up')"
            >Move up</button
          >
          <button
            class="text-button"
            :disabled="busy || projectController.loading || orderIndex >= orderGroup.length - 1"
            @click="projectController.reorder(selectedProject, 'down')"
            >Move down</button
          >
        </div>
      </article>
    </div>
    <ProjectWorkflowPanel @scaffold-website="openScaffoldWebsite" />
    <WebsiteEditor
      v-if="editorOpen"
      :original="editing"
      :scaffold="scaffold"
      @close="editorOpen = false"
    />
    <TomcatWebsiteEditor
      v-if="tomcatEditorOpen"
      :original="editing"
      @close="tomcatEditorOpen = false"
    />
    <ForgeDialog
      v-if="pendingDelete"
      title="Remove website?"
      description="Remove the host record, generated server configuration and managed certificate. Your project directory and source files are kept."
      @close="pendingDelete = undefined"
    >
      <div class="website-form"
        ><label
          >Type {{ pendingDelete.domain }} to confirm<input
            v-model="confirmation"
            autofocus
            autocomplete="off"
            @keyup.enter="remove" /></label
        ><p v-if="projectController.error" class="forge-alert forge-alert--error" role="alert">{{
          projectController.error
        }}</p></div
      >
      <template #footer
        ><button class="action-button" @click="pendingDelete = undefined">Cancel</button
        ><button
          class="action-button action-button--danger"
          :disabled="busy || confirmation !== pendingDelete.domain"
          @click="remove"
          >Remove configuration</button
        ></template
      >
    </ForgeDialog>
    <ForgeDialog
      v-if="pendingPark"
      title="Add sites from subdirectories?"
      :description="
        'Create a subdomain of ' +
        pendingPark.domain +
        ' for each eligible folder directly under its root.'
      "
      @close="pendingPark = undefined"
    >
      <p class="website-help">{{ pendingPark.path }}</p>
      <template #footer>
        <button class="action-button" @click="pendingPark = undefined">Cancel</button>
        <button class="primary-button" :disabled="busy || projectController.loading" @click="park"
          >Add subdirectory sites</button
        >
      </template>
    </ForgeDialog>
    <WebsiteFilesDialog
      v-if="logsProject"
      :project="logsProject"
      kind="log"
      @close="logsProject = undefined"
    />
    <WebsiteFilesDialog
      v-if="vhostsProject"
      :project="vhostsProject"
      kind="config"
      @close="vhostsProject = undefined"
    />
    <QrCodePanel v-if="qrValue" :initial-value="qrValue" @close="qrValue = undefined" />
    <VhostTemplatePanel v-if="templatesOpen" @close="templatesOpen = false" />
    <WebsiteBackupPanel v-if="backupOpen" @close="backupOpen = false" />
    <WebsiteHostsPanel v-if="hostsOpen" @close="hostsOpen = false" />
    <WebsiteLinksDialog
      v-if="linksProject"
      :host="linksProject.host"
      @close="linksProject = undefined"
    />
  </section>
</template>
<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { BrewStore } from '@/store/brew'
  import { projectController, type ProjectItem } from '../state/projectController'
  import WebsiteEditor from '../websites/WebsiteEditor.vue'
  import TomcatWebsiteEditor from '../websites/TomcatWebsiteEditor.vue'
  import WebsiteFilesDialog from '../websites/WebsiteFilesDialog.vue'
  import WebsiteBackupPanel from '../websites/WebsiteBackupPanel.vue'
  import WebsiteHostsPanel from '../websites/WebsiteHostsPanel.vue'
  import WebsiteLinksDialog from '../websites/WebsiteLinksDialog.vue'
  import ForgeDialog from '../components/ForgeDialog.vue'
  import { editableWebsite } from '../websites/model'
  import type { WebsiteHost } from '../websites/types'
  import ProjectWorkflowPanel from '../components/ProjectWorkflowPanel.vue'
  import QrCodePanel from '../components/QrCodePanel.vue'
  import { websitePort, websiteServers, websiteUrl } from '../websites/model'
  import VhostTemplatePanel from '../components/VhostTemplatePanel.vue'
  import { isDirectProjectSite, isTomcatSite } from '@shared/siteRuntime'
  import { navigateNext } from '../state/app'
  const query = ref('')
  const sort = ref<'saved' | 'name' | 'domain' | 'runtime' | 'ssl'>('saved')
  const selectedProject = computed(() => projectController.selected.project)
  const filteredProjects = computed(() => {
    const key = sort.value
    const matches = projectController.projects.filter((item) =>
      (item.name + ' ' + item.domain).toLowerCase().includes(query.value.toLowerCase())
    )
    if (key === 'saved')
      return matches.sort((a, b) => Number(!!b.host.isTop) - Number(!!a.host.isTop))
    if (key === 'ssl') return matches.sort((a, b) => Number(b.ssl) - Number(a.ssl))
    return matches.sort((a, b) => a[key].localeCompare(b[key]))
  })
  const orderGroup = computed(() =>
    projectController.projects.filter(
      (project) => !!project.host.isTop === !!selectedProject.value?.host.isTop
    )
  )
  const orderIndex = computed(() =>
    orderGroup.value.findIndex((project) => project.id === selectedProject.value?.id)
  )
  const sslLabel = (host: WebsiteHost) => {
    if (!host.useSSL) return 'Disabled'
    if (!host.ssl?.cert || !host.ssl?.key)
      return host.autoSSL ? 'Managed certificate pending' : 'Certificate incomplete'
    return host.autoSSL ? 'Managed certificate' : 'Custom certificate'
  }
  const busy = computed(() => projectController.saving)
  const editorOpen = ref(false)
  const tomcatEditorOpen = ref(false)
  const editing = ref<WebsiteHost>()
  const scaffold = ref<{ dir: string; rewrite: string }>()
  const pendingDelete = ref<ProjectItem>()
  const confirmation = ref('')
  const logsProject = ref<ProjectItem>()
  const vhostsProject = ref<ProjectItem>()
  const qrValue = ref<string>()
  const templatesOpen = ref(false)
  const pendingPark = ref<ProjectItem>()
  const backupOpen = ref(false)
  const hostsOpen = ref(false)
  const linksProject = ref<ProjectItem>()
  const brew = BrewStore()
  const chosenServer = ref<(typeof websiteServers)[number]['flag']>()
  const server = computed({
    get: () =>
      chosenServer.value ??
      websiteServers.find(({ flag }) => brew.module(flag).installed.some((version) => version.run))
        ?.flag ??
      'nginx',
    set: (value) => {
      chosenServer.value = value
    }
  })
  const endpoint = computed(() => {
    const host = selectedProject.value?.host
    if (!host) return undefined
    try {
      return websiteUrl(host, server.value)
    } catch {
      return undefined
    }
  })
  const openTomcatEditor = (host?: WebsiteHost) => {
    projectController.error = ''
    editing.value = host
    tomcatEditorOpen.value = true
  }
  const openEditor = (host?: WebsiteHost) => {
    if (host && !editableWebsite(host)) return
    if (host && isTomcatSite(host)) {
      openTomcatEditor(host)
      return
    }
    projectController.error = ''
    editing.value = host
    scaffold.value = undefined
    editorOpen.value = true
  }
  const openScaffoldWebsite = (draft: { dir: string; rewrite: string }) => {
    openEditor()
    scaffold.value = draft
  }
  const openProject = () => {
    if (selectedProject.value) void projectController.open(selectedProject.value, server.value)
  }
  const openScheduledTasks = (project: ProjectItem) =>
    navigateNext('cron', { id: project.id, name: project.domain, root: project.path })
  const prepareRemoval = (project: ProjectItem) => {
    pendingDelete.value = project
    confirmation.value = ''
  }
  const remove = async () => {
    if (
      pendingDelete.value &&
      (await projectController.remove(pendingDelete.value, confirmation.value))
    )
      pendingDelete.value = undefined
  }
  const park = () => {
    const project = pendingPark.value
    if (!project) return
    pendingPark.value = undefined
    void projectController.park(project)
  }
  onMounted(() => {
    void projectController.refresh()
  })
</script>
