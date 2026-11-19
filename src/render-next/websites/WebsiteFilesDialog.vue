<template>
  <ServiceFilesDialog
    :name="project.domain"
    :kind="kind"
    :owner="websiteFileController"
    :provider="files"
    :after-save="kind === 'config' ? reloadServer : undefined"
    :model-value="true"
    @update:model-value="emit('close')"
  >
    <template v-if="kind === 'config'" #file-actions="{ file }">
      <div class="website-external-editor">
        <select v-model="editor" class="action-button" aria-label="External editor">
          <option value="VSCode">Visual Studio Code</option>
          <option value="PhpStorm">PhpStorm</option>
          <option value="WebStorm">WebStorm</option>
          <option value="Sublime">Sublime Text</option>
        </select>
        <button
          type="button"
          class="action-button"
          :disabled="
            file.exists === false ||
            websiteFileController.openingExternal ||
            websiteFileController.saving
          "
          @click="websiteFileController.openExternal(file, editor)"
          >Open in editor</button
        >
      </div>
    </template>
  </ServiceFilesDialog>
</template>

<script lang="ts">
  import { reactive } from 'vue'
  import { ServiceFilesController } from '../state/serviceFilesController'

  const websiteFileController = reactive(new ServiceFilesController())
</script>

<script setup lang="ts">
  import { ref } from 'vue'
  import ServiceFilesDialog from '../components/ServiceFilesDialog.vue'
  import { projectController, type ProjectItem } from '../state/projectController'
  import type { ServiceFile, ServiceFileEditor } from '../state/serviceFilesController'

  const props = defineProps<{ project: ProjectItem; kind: 'config' | 'log' }>()
  const emit = defineEmits<{ close: [] }>()
  const editor = ref<ServiceFileEditor>('VSCode')
  const files = async (): Promise<ServiceFile[]> => {
    const items = await (props.kind === 'log'
      ? projectController.logs(props.project)
      : projectController.vhosts(props.project))
    return items.map(({ label, ...file }) => ({ ...file, kind: props.kind, name: label }))
  }
  const reloadServer = (file: ServiceFile) => projectController.afterFileSave(file.path)
</script>

<style scoped>
  .website-external-editor {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }
  .website-external-editor select {
    background: var(--pqt-field);
  }
</style>
