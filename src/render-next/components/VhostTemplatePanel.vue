<template>
  <ForgeDialog title="Vhost templates" description="Edit the templates used when QTEnvDev generates Nginx, Apache, Caddy and FrankenPHP host files." eyebrow="WEBSITES / TEMPLATES" wide @close="emit('close')">
    <div class="template-panel"><div class="template-toolbar"><label>Template<select v-model="controller.selected" :disabled="controller.loading || controller.saving" @change="controller.load(controller.selected)"><option v-for="item in controller.templates" :key="item.key" :value="item.key">{{ item.label }}</option></select></label><button class="action-button" :disabled="controller.saving" @click="controller.reveal()">Reveal file ↗</button></div><textarea v-model="controller.content" :disabled="controller.loading || controller.saving" spellcheck="false" /><p v-if="controller.error" class="forge-alert forge-alert--error" role="alert">{{ controller.error }}</p></div>
    <template #footer><span class="website-help">Changes apply to newly generated hosts and the next save of an existing host.</span><button class="action-button" @click="emit('close')">Close</button><button class="primary-button" :disabled="controller.loading || controller.saving" @click="save">{{ controller.saving ? 'Saving…' : 'Save template' }}</button></template>
  </ForgeDialog>
</template>
<script setup lang="ts">
import { onMounted } from 'vue'
import ForgeDialog from './ForgeDialog.vue'
import { vhostTemplateController as controller } from '../state/vhostTemplateController'
const emit = defineEmits<{ close: [] }>()
const save = async () => { if (await controller.save()) emit('close') }
onMounted(() => { void controller.load() })
</script>
