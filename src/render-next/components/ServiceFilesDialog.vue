<template>
  <ForgeDialog v-if="open" wide :title="title" :description="description" @close="close">
    <div class="service-files">
      <aside class="service-file-list"><button v-for="file in controller.files" :key="file.path" class="service-file-item" :class="{ selected: controller.selected?.path === file.path }" @click="controller.select(file)"><span>{{ file.name }}</span><small>{{ file.exists === false ? 'Not found' : file.path }}</small></button><p v-if="!controller.files.length && !controller.loading" class="empty-copy">No {{ kind }} files were reported for this version.</p></aside>
      <div class="service-file-editor"><p v-if="controller.loading" class="empty-copy">Loading file list…</p><template v-else-if="controller.selected"><div class="service-file-toolbar"><code>{{ controller.selected.path }}</code><button class="action-button" @click="controller.reveal()">Reveal</button><button class="action-button" @click="controller.readSelected()">Refresh</button></div><textarea v-if="kind === 'config'" v-model="controller.content" spellcheck="false" /><pre v-else class="service-log-preview">{{ controller.content || 'Select a log file to read it.' }}</pre></template><p v-if="controller.error" class="forge-alert forge-alert--error" role="alert">{{ controller.error }}</p></div>
    </div>
    <template #footer><div></div><div class="detail-actions"><button class="action-button" @click="close">Close</button><button v-if="kind === 'config'" class="action-button action-button--primary" :disabled="!controller.selected || controller.saving" @click="save">{{ controller.saving ? 'Saving…' : 'Save configuration' }}</button></div></template>
  </ForgeDialog>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import ForgeDialog from './ForgeDialog.vue'
import { serviceFilesController as controller } from '../state/serviceFilesController'
const props = defineProps<{ name: string; version?: string; kind: 'config' | 'log'; modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
const open = computed(() => props.modelValue)
const title = computed(() => `${props.name} ${props.kind === 'config' ? 'configuration' : 'logs'}`)
const description = computed(() => props.kind === 'config' ? 'Edit the reported configuration file. Changes are written only after Save configuration.' : 'Read and reveal log files reported by the service module.')
const close = () => { emit('update:modelValue', false); controller.clear() }
const save = async () => { if (await controller.save()) close() }
const load = () => { if (props.modelValue) void controller.open(props.name, props.version, props.kind) }
import { watch } from 'vue'; watch(() => props.modelValue, load, { immediate: true })
</script>
