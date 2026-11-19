<template>
  <ServiceFilesDialog
    :name="project.domain"
    :kind="kind"
    :owner="websiteFileController"
    :provider="files"
    :after-save="kind === 'config' ? reloadServer : undefined"
    :model-value="true"
    @update:model-value="emit('close')"
  />
</template>

<script lang="ts">
import { reactive } from 'vue'
import { ServiceFilesController } from '../state/serviceFilesController'

const websiteFileController = reactive(new ServiceFilesController())
</script>

<script setup lang="ts">
import ServiceFilesDialog from '../components/ServiceFilesDialog.vue'
import { projectController, type ProjectItem } from '../state/projectController'
import type { ServiceFile } from '../state/serviceFilesController'

const props = defineProps<{ project: ProjectItem; kind: 'config' | 'log' }>()
const emit = defineEmits<{ close: [] }>()
const files = async (): Promise<ServiceFile[]> => {
  const items = await (props.kind === 'log' ? projectController.logs(props.project) : projectController.vhosts(props.project))
  return items.map(({ label, ...file }) => ({ ...file, kind: props.kind, name: label }))
}
const reloadServer = (file: ServiceFile) => projectController.afterFileSave(file.path)
</script>
