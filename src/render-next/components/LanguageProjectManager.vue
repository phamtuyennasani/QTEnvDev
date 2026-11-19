<template>
  <ForgeDialog title="Manage language projects" eyebrow="WEBSITES / PROJECTS" wide @close="emit('close')">
    <div class="project-manager-controls">
      <label>
        Language
        <select v-model="language">
          <option v-for="(label, kind) in workflowLabels" :key="kind" :value="kind">{{ label }}</option>
        </select>
      </label>
      <div class="detail-actions">
        <button class="action-button" :aria-pressed="tab === 'saved'" @click="tab = 'saved'">Saved projects</button>
        <button class="action-button" :aria-pressed="tab === 'create'" @click="tab = 'create'">Create from template</button>
      </div>
    </div>
    <p v-if="runtimeWarning" class="forge-alert" role="status">{{ runtimeWarning }}</p>
    <div class="pqt-established-tool pqt-language-project-surface dark">
      <component :is="surface" :key="language + ':' + tab" v-bind="viewProps" />
    </div>
  </ForgeDialog>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'
import ForgeDialog from './ForgeDialog.vue'
import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'
import { projectWorkflowController, workflowLabels, type WorkflowKind } from '../state/projectWorkflowController'

const props = defineProps<{ initialLanguage: WorkflowKind }>()
const emit = defineEmits<{ close: []; scaffoldWebsite: [project: { dir: string; rewrite: string }] }>()
provideLegacyToolContext({ poperFix: true, detachedClass: 'pqt-language-project-surface' })

const language = ref<WorkflowKind>(props.initialLanguage)
const tab = ref<'saved' | 'create'>('saved')
const runtimeWarning = ref('')
let generation = 0
const projects = defineAsyncComponent(() => import('@/components/LanguageProjects/index.vue'))
const nodeProjects = defineAsyncComponent(() => import('@/components/Nodejs/projects/index.vue'))
const scaffolds = {
  php: defineAsyncComponent(() => import('@/components/PHP/CreateProject.vue')),
  node: defineAsyncComponent(() => import('@/components/Nodejs/CreateProject.vue')),
  python: defineAsyncComponent(() => import('@/components/Python/CreateProject.vue')),
  golang: defineAsyncComponent(() => import('@/components/GoLang/CreateProject.vue'))
}
const surface = computed(() =>
  tab.value === 'create' ? scaffolds[language.value] : language.value === 'node' ? nodeProjects : projects
)
const viewProps = computed(() => {
  if (tab.value === 'saved' && language.value !== 'node') {
    return { typeFlag: language.value, title: workflowLabels[language.value] }
  }
  if (tab.value === 'create' && language.value === 'php') {
    return { websiteEditor: 'parent', onScaffoldWebsite: (project: { dir: string; rewrite: string }) => emit('scaffoldWebsite', project) }
  }
  return {}
})
watch(language, async (kind) => {
  const current = ++generation
  runtimeWarning.value = ''
  const available = await projectWorkflowController.loadRuntime(kind).catch(() => false)
  if (!available && current === generation) runtimeWarning.value = 'Installed ' + workflowLabels[kind] + ' versions could not be refreshed.'
}, { immediate: true })
onBeforeUnmount(() => { generation++ })
</script>

<style scoped>
.project-manager-controls, .project-manager-controls label { display: flex; align-items: center; gap: 10px; }
.project-manager-controls { justify-content: space-between; margin-bottom: 12px; }
.project-manager-controls select { color: var(--pqt-text); background: var(--pqt-canvas); border: 1px solid var(--pqt-border); border-radius: 6px; padding: 6px; }
</style>
