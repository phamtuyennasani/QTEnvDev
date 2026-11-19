<template>
  <div class="custom-modules">
    <header class="custom-module-heading">
      <div>
        <h2>Custom modules</h2>
        <p class="muted">Run your own commands, with optional service control, configuration, and logs.</p>
      </div>
      <div class="detail-actions">
        <button class="action-button" :disabled="disabled" @click="editCategory()">Add category</button>
        <button class="action-button action-button--primary" :disabled="disabled" @click="openEditor()">Add module</button>
      </div>
    </header>

    <p v-if="controller.pending" class="muted" role="status">{{ controller.pending }}…</p>
    <p v-if="controller.error && !editor && !category" class="forge-alert forge-alert--error" role="alert">{{ controller.error }}</p>
    <button v-if="!controller.ready && !controller.pending" class="action-button" @click="controller.load()">Load again</button>

    <template v-if="controller.ready">
      <div v-if="controller.groups.length" class="custom-category-bar">
        <label>Category
          <select v-model="categoryId">
            <option value="">All modules</option>
            <option v-for="group in controller.groups" :key="group.id" :value="group.id">{{ group.label }}</option>
          </select>
        </label>
        <div v-if="selectedCategory" class="detail-actions">
          <button class="action-button" :disabled="disabled" @click="editCategory(selectedCategory)">Rename category</button>
          <button class="action-button" :disabled="disabled" @click="removal = { category: selectedCategory }">Remove category</button>
        </div>
      </div>

      <p v-if="!modules.length" class="muted">No custom modules in this view.</p>
      <article v-for="module in modules" :key="module.id" class="custom-module">
        <header class="custom-module-heading">
          <div>
            <h3>{{ module.label }}</h3>
            <small>{{ module.isService ? (module.isOnlyRunOne ? 'Single instance service' : 'Service') : 'Command collection' }}</small>
          </div>
          <div class="detail-actions">
            <button v-if="module.configPath?.length" class="action-button" @click="openFiles(module, 'config')">Config</button>
            <button v-if="module.logPath?.length" class="action-button" @click="openFiles(module, 'log')">Logs</button>
            <button class="action-button" :disabled="disabled" @click="openEditor(module)">Edit</button>
            <button class="action-button" :disabled="disabled" @click="removal = { module }">Remove</button>
          </div>
        </header>
        <p v-if="!module.item.length" class="muted">Edit the module to add a command.</p>
        <div v-for="item in module.item" :key="item.id" class="custom-command">
          <div>
            <b>{{ item.name }}</b>
            <small v-if="item.comment">{{ item.comment }}</small>
            <small v-if="item.startOutcomeUnknown">Start outcome unknown</small>
            <small v-else-if="item.running">In progress…</small>
            <small v-else-if="module.isService">{{ item.run ? 'Running' : 'Stopped' }}</small>
          </div>
          <div class="detail-actions">
            <button v-if="!item.run" class="action-button" :disabled="disabled || item.running || item.startOutcomeUnknown" @click="controller.service(module, item, 'start')">{{ module.isService ? 'Start' : 'Run' }}</button>
            <template v-else>
              <button class="action-button" :disabled="disabled || item.running" @click="controller.service(module, item, 'restart')">Restart</button>
              <button class="action-button" :disabled="disabled || item.running" @click="controller.service(module, item, 'stop')">Stop</button>
            </template>
            <button v-if="item.configPath?.length" class="action-button" @click="openFiles(module, 'config', item)">Config</button>
            <button v-if="item.logPath?.length || canReadDefaultLogs" class="action-button" @click="openFiles(module, 'log', item)">Logs</button>
          </div>
        </div>
      </article>
    </template>

    <ModuleEditor
      v-if="editor"
      :is-edit="Boolean(editor.module)"
      :edit="editor.draft"
      :groups="controller.groups"
      :save-draft="saveDraft"
      :save-error="controller.error"
      @dismiss="editor = undefined"
    />
    <ForgeDialog v-if="category" :title="category.group ? 'Rename category' : 'Add category'" @close="closeCategory">
      <form id="custom-module-category" @submit.prevent="saveCategory">
        <label class="custom-category-field">Category name <input v-model="category.label" required autofocus /></label>
        <p v-if="controller.error" class="forge-alert forge-alert--error" role="alert">{{ controller.error }}</p>
      </form>
      <template #footer>
        <button class="action-button" :disabled="Boolean(controller.pending)" @click="closeCategory">Cancel</button>
        <button class="action-button action-button--primary" type="submit" form="custom-module-category" :disabled="disabled">Save category</button>
      </template>
    </ForgeDialog>
    <ForgeDialog v-if="removal" :title="`Remove ${removal.module?.label ?? removal.category?.label}?`" @close="removal = undefined">
      <p v-if="removal.module">Active commands will be stopped before the definition is removed.</p>
      <p v-else>Move any modules in this category before removing it.</p>
      <template #footer>
        <button class="action-button" @click="removal = undefined">Cancel</button>
        <button class="action-button action-button--danger" :disabled="disabled" @click="remove">Remove</button>
      </template>
    </ForgeDialog>
    <ServiceFilesDialog
      v-if="files"
      :name="files.title"
      :kind="files.kind"
      :provider="files.provider"
      :owner="customFilesController"
      :model-value="true"
      @update:model-value="files = undefined"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, reactive, ref, shallowRef } from 'vue'
import type { CustomerModuleCateItem, CustomerModuleItem } from '@/core/Module'
import type { ModuleCustomer, ModuleCustomerExecItem } from '@/core/ModuleCustomer'
import { join } from '@/util/path-browserify'
import ForgeDialog from '../components/ForgeDialog.vue'
import ServiceFilesDialog from '../components/ServiceFilesDialog.vue'
import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'
import { customModulesController as controller } from './customModulesController'
import { customFilesController, type CustomModuleFileView } from './customModuleFiles'

provideLegacyToolContext()
const ModuleEditor = defineAsyncComponent(() => import('@/components/Setup/Module/module/moduleAdd.vue'))
const categoryId = ref('')
const editor = shallowRef<{ module?: ModuleCustomer; draft: Partial<CustomerModuleItem> }>()
const category = ref<{ group?: CustomerModuleCateItem; label: string }>()
const removal = shallowRef<{ module?: ModuleCustomer; category?: CustomerModuleCateItem }>()
const files = shallowRef<CustomModuleFileView>()
const disabled = computed(() => !controller.ready || Boolean(controller.pending))
const selectedCategory = computed(() => controller.groups.find(group => group.id === categoryId.value))
const modules = computed(() => selectedCategory.value
  ? controller.modules.filter(module => module.moduleType === selectedCategory.value?.moduleType)
  : controller.modules)
const canReadDefaultLogs = computed(() => Boolean(window.Server.BaseDir))

function openEditor(module?: ModuleCustomer) {
  controller.error = ''
  editor.value = {
    module,
    draft: module ? JSON.parse(JSON.stringify(module)) : { moduleType: selectedCategory.value?.moduleType ?? '' }
  }
}

function saveDraft(draft: CustomerModuleItem) {
  return controller.save(draft, editor.value?.module)
}

function editCategory(group?: CustomerModuleCateItem) {
  controller.error = ''
  category.value = reactive({ group, label: group?.label ?? '' })
}

function closeCategory() {
  if (!controller.pending) category.value = undefined
}

async function saveCategory() {
  const entry = category.value
  if (entry && await controller.saveGroup(entry.label, entry.group)) category.value = undefined
}

function remove() {
  const entry = removal.value
  removal.value = undefined
  if (entry?.module) void controller.remove(entry.module)
  else if (entry?.category) void controller.removeGroup(entry.category)
}

function openFiles(module: ModuleCustomer, kind: 'config' | 'log', item?: ModuleCustomerExecItem) {
  const paths = [...((item ?? module)[kind === 'config' ? 'configPath' : 'logPath'] ?? [])]
  if (kind === 'log' && item && window.Server.BaseDir && /^[\w-]+$/.test(item.id)) {
    const base = join(window.Server.BaseDir, 'module-customer')
    paths.unshift(
      { name: 'Output log', path: join(base, `${item.id}.out.log`) },
      { name: 'Error log', path: join(base, `${item.id}.error.log`) }
    )
  }
  files.value = {
    title: item ? `${module.label} / ${item.name}` : module.label,
    kind,
    provider: async () => paths.filter(entry => entry.path).map(entry => ({ ...entry, kind }))
  }
}

void controller.load()
</script>

<style scoped>
.custom-modules { display: grid; gap: 16px; }
.custom-module-heading, .custom-category-bar, .custom-command { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
.custom-module-heading p, .custom-module-heading h3 { margin: 0; }
.custom-module-heading .detail-actions, .custom-command .detail-actions { flex-wrap: wrap; }
.custom-module { border: 1px solid var(--pqt-border); border-radius: 8px; padding: 14px; }
.custom-module small { display: block; color: var(--pqt-text-muted); margin-top: 4px; }
.custom-command { border-top: 1px solid var(--pqt-border); margin-top: 12px; padding-top: 12px; }
.custom-category-bar label, .custom-category-field { display: flex; align-items: center; gap: 10px; }
.custom-category-bar select, .custom-category-field input { background: var(--pqt-surface); color: inherit; border: 1px solid var(--pqt-border); border-radius: 6px; padding: 7px 10px; }
</style>
