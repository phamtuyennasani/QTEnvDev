<template>
  <section class="screen"
    ><header class="page-header"
      ><div
        ><p class="eyebrow">WORKSPACE / RUNTIMES</p><h1>Runtimes</h1
        ><p class="subtitle">Versions available to your local projects.</p></div
      ><div class="detail-actions"
        ><button v-if="gitVisible" class="action-button" @click="gitOpen = true"
          >Git environment</button
        ><button class="primary-button" @click="packageBrowser?.show()">+ Add runtime</button></div
      ></header
    ><div class="runtime-layout"
      ><article class="panel runtime-list-panel"
        ><div class="list-heading runtime-heading"
          ><span>Runtime</span><span>Version</span><span>Projects</span><span>Status</span></div
        ><button
          v-for="runtime in visibleRuntimes"
          :key="runtime.name"
          class="runtime-item"
          :class="{ selected: selectedRuntime?.name === runtime.name }"
          @click="runtimeController.select(runtime.name)"
          ><span class="runtime-primary"
            ><span class="runtime-mark">{{ runtime.name.slice(0, 1) }}</span
            ><span
              ><b>{{ runtime.name }}</b
              ><small>{{ runtime.family }}</small></span
            ></span
          ><code>{{ runtime.version }}</code
          ><span class="runtime-projects">{{ runtime.projects ?? '—' }}</span
          ><span class="state-label">{{
            runtime.state === 'active' ? 'Installed' : 'Available'
          }}</span></button
        ></article
      ><article v-if="selectedRuntime" class="panel runtime-detail-panel"
        ><div class="detail-top"
          ><div
            ><p class="eyebrow">RUNTIME DETAIL</p><h2>{{ selectedRuntime.name }}</h2
            ><p class="detail-kind"
              >{{ selectedRuntime.family }} · <code>{{ selectedRuntime.version }}</code></p
            ></div
          ><span class="runtime-mark runtime-mark--large">{{
            selectedRuntime.name.slice(0, 1)
          }}</span></div
        ><div class="runtime-facts"
          ><div
            ><span>Install path</span><code>{{ selectedRuntime.path }}</code></div
          ><div
            ><span>Assigned projects</span><b>{{ selectedRuntime.projects ?? '—' }}</b></div
          ></div
        ><div v-if="selectedFlag" class="detail-actions">
          <button class="action-button" @click="versionsOpen = true"
            >Installed versions</button
          ><button v-if="projectKind" class="action-button" @click="managedLanguage = projectKind"
            >Manage projects</button
          > </div
        ><div v-if="selectedRuntime.name === 'PHP'" class="runtime-tools"
          ><div class="php-projects"
            ><div class="detail-actions"
              ><b>PHP projects</b
              ><button class="action-button" @click="projects.load()">Refresh</button></div
            ><input v-model="projects.state.query" placeholder="Filter projects" /><div
              v-for="project in projects.filtered()"
              :key="project.id"
              class="php-project-row"
              ><span
                ><b>{{ project.comment || 'Unnamed project' }}</b
                ><small>{{ project.path }}</small></span
              ><button
                class="action-button"
                @click="projects.run(project as any, !project.state.isRun)"
                >{{ project.state.isRun ? 'Stop' : 'Start' }}</button
              ></div
            ></div
          ><div class="detail-actions"
            ><button class="action-button" :disabled="php.state.loading" @click="php.load()">{{
              php.state.loading ? 'Reading PHP…' : 'Refresh PHP details'
            }}</button
            ><button class="action-button" @click="php.openFolder()">Open PHP folder</button
            ><button class="action-button" :disabled="!phpVersion" @click="phpConfigOpen = true"
              >Edit php.ini</button
            ><button class="action-button" :disabled="!phpVersion" @click="extensionsOpen = true"
              >Manage extensions</button
            ><button class="action-button" @click="composerOpen = true">Composer</button></div
          ><p v-if="php.state.error" class="forge-alert forge-alert--error">{{ php.state.error }}</p
          ><div class="runtime-facts"
            ><div
              ><span>php.ini</span><code>{{ php.state.iniPath || 'Not loaded' }}</code></div
            ><div
              ><span>Loaded extensions</span><b>{{ php.state.extensions.length }}</b></div
            ></div
          ><div class="extension-browser"
            ><input v-model="php.state.query" placeholder="Filter loaded extensions" /><div
              class="extension-pills"
              ><span
                v-for="name in php.state.extensions.filter((name) =>
                  name.toLowerCase().includes(php.state.query.toLowerCase())
                )"
                :key="name"
                >{{ name }}</span
              ><small
                v-if="
                  !php.state.extensions.filter((name) =>
                    name.toLowerCase().includes(php.state.query.toLowerCase())
                  ).length
                "
                >No loaded extensions found.</small
              ></div
            ></div
          ></div
        ><ServiceFilesDialog
          v-if="phpConfigOpen && phpVersion"
          v-model="phpConfigOpen"
          name="PHP"
          :version="phpVersion"
          kind="config"
        >
          <template #configuration="{ content, readOnly, update }">
            <PhpCommonConfiguration :content="content" :read-only="readOnly" @update="update" />
          </template>
        </ServiceFilesDialog><PhpExtensionsPanel
          v-if="extensionsOpen && phpVersion"
          :version="phpVersion"
          @close="extensionsOpen = false" /><div
          v-if="selectedRuntime.name === 'Node.js'"
          class="detail-actions"
          ><button class="action-button" @click="workflow = 'node'">Node.js version managers</button
          ><button class="action-button" @click="workflow = 'npm'">npm configuration</button></div
        ><button
          v-if="selectedRuntime.name === 'Go' && supportsGvm"
          class="action-button"
          @click="workflow = 'gvm'"
          >Go Version Manager</button
        ><button v-if="selectedFlag === 'flutter'" class="action-button" @click="flutterToolsOpen = true"
          >Flutter tools</button
        ><PackageBrowser
          v-if="selectedFlag"
          ref="packageBrowser"
          :key="selectedFlag"
          :flag="selectedFlag"
          :title="selectedRuntime.name" /></article></div
    ><RuntimeWorkflowDialog v-if="workflow" :workflow="workflow" @close="workflow = undefined" />
    <GitEnvironmentDialog v-if="gitOpen && gitVisible" @close="gitOpen = false" />
    <LanguageProjectManager
      v-if="managedLanguage"
      :initial-language="managedLanguage"
      eyebrow="RUNTIMES / PROJECTS"
      @close="managedLanguage = undefined"
      @scaffold-website="openScaffoldWebsite"
    />
    <WebsiteEditor v-if="websiteScaffold" :scaffold="websiteScaffold" @close="websiteScaffold = undefined" />
    <FlutterToolsDialog v-if="flutterToolsOpen" @close="flutterToolsOpen = false" />
    <InstalledVersionsDialog
      v-if="versionsOpen && selectedFlag && selectedRuntime"
      :key="selectedFlag"
      :flag="selectedFlag"
      :title="selectedRuntime.name"
      runtime
      @close="versionsOpen = false"
    />
    <ComposerVersionsDialog
      v-if="composerOpen && selectedRuntime?.name === 'PHP'"
      @close="composerOpen = false"
      @packages="openComposerPackages"
    />
  </section>
</template>
<script setup lang="ts">
  import { computed, defineAsyncComponent, nextTick, onMounted, ref } from 'vue'
  import { runtimeController } from '../state/runtimeController'
  import PackageBrowser from '../components/PackageBrowser.vue'
  import ServiceFilesDialog from '../components/ServiceFilesDialog.vue'
  import PhpCommonConfiguration from '../php/CommonConfiguration.vue'
  import PhpExtensionsPanel from '../components/PhpExtensionsPanel.vue'
  import { phpProjectsController } from '../state/phpProjectsController'
  import { phpController } from '../state/phpController'
  import { isBuiltinModuleVisible } from '../moduleVisibility/visibility'
  import { runtimeModuleFlags } from '../adapters/runtimeAdapter'
  import { isWorkflowKind, projectWorkflowController, type WorkflowKind } from '../state/projectWorkflowController'
  const RuntimeWorkflowDialog = defineAsyncComponent(
    () => import('../components/RuntimeWorkflowDialog.vue')
  )
  const GitEnvironmentDialog = defineAsyncComponent(
    () => import('../components/GitEnvironmentDialog.vue')
  )
  const ComposerVersionsDialog = defineAsyncComponent(
    () => import('../components/ComposerVersionsDialog.vue')
  )
  const LanguageProjectManager = defineAsyncComponent(
    () => import('../components/LanguageProjectManager.vue')
  )
  const WebsiteEditor = defineAsyncComponent(() => import('../websites/WebsiteEditor.vue'))
  const InstalledVersionsDialog = defineAsyncComponent(
    () => import('../serviceVersions/InstalledVersionsDialog.vue')
  )
  const FlutterToolsDialog = defineAsyncComponent(() => import('../components/FlutterToolsDialog.vue'))
  const gitVisible = computed(() => isBuiltinModuleVisible('git'))
  const gitOpen = ref(false)
  const workflow = ref<'node' | 'npm' | 'gvm'>()
  const supportsGvm = computed(() => Boolean(window.Server.isMacOS || window.Server.isLinux))
  const packageBrowser = ref<InstanceType<typeof PackageBrowser>>()
  const composerOpen = ref(false)
  const versionsOpen = ref(false)
  const flutterToolsOpen = ref(false)
  const openComposerPackages = async () => {
    composerOpen.value = false
    await nextTick()
    packageBrowser.value?.show('composer')
  }
  const projects = phpProjectsController
  const phpConfigOpen = ref(false)
  const extensionsOpen = ref(false)
  const visibleRuntimes = runtimeController.visibleRuntimes
  const selectedRuntime = computed(() => {
    const runtimes = visibleRuntimes.value
    return (
      runtimes.find((runtime) => runtime.name === runtimeController.selected.name) ?? runtimes[0]
    )
  })
  const selectedFlag = computed(() =>
    selectedRuntime.value ? runtimeModuleFlags[selectedRuntime.value.name] : undefined
  )
  const projectKind = computed(() => {
    const flag = selectedFlag.value
    return isWorkflowKind(flag) ? flag : undefined
  })
  const managedLanguage = ref<WorkflowKind>()
  const websiteScaffold = ref<{ dir: string; rewrite: string }>()
  const openScaffoldWebsite = (project: { dir: string; rewrite: string }) => {
    managedLanguage.value = undefined
    websiteScaffold.value = project
  }
  const php = phpController
  const phpVersion = computed(() => php.current())
  onMounted(() => {
    runtimeController.refresh().catch()
    phpProjectsController.load().catch()
    void projectWorkflowController.load()
  })
</script>
