<template>
  <ForgeDialog v-if="open" wide :title="title" :description="description" @close="close">
    <div class="service-files">
      <aside class="service-file-list"><button v-for="file in controller.files" :key="file.path" class="service-file-item" :class="{ selected: controller.selected?.path === file.path }" @click="controller.select(file)"><span>{{ file.name }}</span><small>{{ file.exists === false ? 'Not found' : file.path }}</small></button><p v-if="!controller.files.length && !controller.loading" class="empty-copy">No {{ kind }} files were reported for this version.</p></aside>
      <div class="service-file-editor">
        <p v-if="controller.loading" class="empty-copy">Loading file list…</p>
        <template v-else-if="controller.selected">
          <div class="service-file-toolbar"><code>{{ controller.selected.path }}</code><button class="action-button" @click="controller.reveal()">Reveal</button><button class="action-button" @click="controller.readSelected()">Refresh</button><slot name="file-actions" :file="controller.selected" /></div>
          <small v-if="kind === 'log'" class="website-help">Showing up to the latest 200 KB.</small>
          <small v-else-if="controller.selected.readOnly" class="website-help">Use the website editor to change this generated file.</small>
          <slot v-if="kind === 'config'" name="configuration" :content="controller.content" :readOnly="!controller.canEdit" :update="updateContent">
            <textarea v-model="controller.content" :readonly="!controller.canEdit" spellcheck="false" />
          </slot>
          <pre v-else class="service-log-preview">{{ controller.content || 'This log is empty.' }}</pre>
        </template>
        <p v-if="controller.error" class="forge-alert forge-alert--error" role="alert">{{ controller.error }}</p>
        <p v-if="controller.warning" class="forge-alert" role="status">{{ controller.warning }}</p>
      </div>
    </div>
    <template #footer><div></div><div class="detail-actions"><button class="action-button" @click="close">Close</button><button v-if="kind === 'log'" class="action-button action-button--danger" :disabled="!controller.selected || controller.saving" @click="pendingClear = controller.selected?.path">Clear log</button><button v-if="kind === 'config' && !controller.selected?.readOnly" class="action-button action-button--primary" :disabled="!controller.canSave" @click="save">{{ controller.saving ? 'Saving…' : 'Save configuration' }}</button></div></template>
  </ForgeDialog>
  <ForgeDialog v-if="open && pendingClear" title="Clear this log?" :description="pendingClear" @close="pendingClear = undefined">
    <template #footer><span>Existing log entries will be removed.</span><div class="detail-actions"><button class="action-button" @click="pendingClear = undefined">Cancel</button><button class="action-button action-button--danger" @click="clearLog">Clear log</button></div></template>
  </ForgeDialog>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { SoftInstalled } from '@shared/app'
import ForgeDialog from './ForgeDialog.vue'
import { serviceFilesController, type ServiceFilesController, type ServiceFile } from '../state/serviceFilesController'
const props = defineProps<{
  name: string
  version?: string | SoftInstalled
  kind: 'config' | 'log'
  modelValue: boolean
  onlyFile?: string
  owner?: Pick<ServiceFilesController, keyof ServiceFilesController>
  provider?: () => Promise<ServiceFile[]>
  afterSave?: (file: ServiceFile) => Promise<string[]>
}>()
const controller = props.owner ?? serviceFilesController
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
const pendingClear = ref<string>()
const open = computed(() => props.modelValue)
const title = computed(() => `${props.name} ${props.kind === 'config' ? 'configuration' : props.onlyFile === 'slow' ? 'slow query log' : 'logs'}`)
const description = computed(() => props.kind === 'config' ? 'Choose a configuration file.' : 'Choose a log file to read or reveal.')
const close = () => emit('update:modelValue', false)
const updateContent = (content: string) => { if (controller.canEdit) controller.content = content }
const save = async () => { if (await controller.save(props.afterSave) && !props.afterSave) close() }
const clearLog = async () => {
  const path = pendingClear.value
  pendingClear.value = undefined
  if (path && controller.selected?.path === path) await controller.clearLog()
}
watch(() => props.modelValue, (visible, previous) => {
  if (visible) {
    if (props.provider) void controller.openProvided(props.provider)
    else void controller.open(props.name, props.version, props.kind, props.onlyFile)
  } else if (previous) {
    pendingClear.value = undefined
    controller.clear()
  }
}, { immediate: true })
onBeforeUnmount(() => { if (props.modelValue) controller.clear() })
</script>
