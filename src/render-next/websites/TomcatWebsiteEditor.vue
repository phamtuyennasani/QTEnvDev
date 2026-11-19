<template>
  <ForgeDialog
    :title="original ? 'Configure Tomcat website' : 'New Tomcat website'"
    eyebrow="WEBSITES / TOMCAT"
    wide
    @close="emit('close')"
  >
    <div class="website-form">
      <div class="form-grid">
        <label>Hostname<input v-model.trim="item.name" placeholder="app.localhost" /></label>
        <label>Comment<input v-model.trim="item.mark" /></label>
      </div>
      <label>
        App base directory
        <div class="path-row">
          <input v-model.trim="item.root" />
          <button class="action-button" @click="chooseRoot">Browse</button>
          <button class="action-button" :disabled="!item.root || scanning" @click="scanAppBase">
            {{ scanning ? 'Scanning…' : 'Scan' }}
          </button>
        </div>
      </label>
      <p v-if="scanMessage" role="status">{{ scanMessage }}</p>
      <div class="section-head">
        <b>Context mappings</b>
        <button class="action-button" @click="addContext">Add context</button>
      </div>
      <div v-for="(context, index) in item.tomcat.contexts" :key="context.id" class="context-row">
        <input v-model.trim="context.path" aria-label="Context path" placeholder="/" />
        <input v-model.trim="context.docBase" aria-label="Document base" placeholder="Document base" />
        <button class="text-button" @click="chooseDocBase(context)">Browse</button>
        <button class="text-button" @click="item.tomcat.contexts.splice(index, 1)">Remove</button>
      </div>
      <label class="switch-line"><span>Enable rewrite rules</span><input v-model="item.tomcat.rewrite.enabled" type="checkbox" /></label>
      <label v-if="item.tomcat.rewrite.enabled">Rewrite rules<textarea v-model="item.tomcat.rewrite.content" rows="5" /></label>
      <div class="form-grid">
        <label>Tomcat port<input v-model.number="item.port.tomcat" type="number" min="1" max="65535" /></label>
        <label v-if="item.useSSL">SSL port<input v-model.number="item.port.tomcat_ssl" type="number" min="1" max="65535" /></label>
      </div>
      <label class="switch-line"><span>Enable HTTPS</span><input v-model="item.useSSL" type="checkbox" /></label>
      <template v-if="item.useSSL">
        <label class="switch-line"><span>Managed certificate</span><input v-model="item.autoSSL" type="checkbox" /></label>
        <div v-if="!item.autoSSL" class="form-grid">
          <label>Certificate<div class="path-row"><input v-model.trim="item.ssl.cert" /><button class="action-button" @click="chooseSSL('cert')">Browse</button></div></label>
          <label>Private key<div class="path-row"><input v-model.trim="item.ssl.key" /><button class="action-button" @click="chooseSSL('key')">Browse</button></div></label>
        </div>
      </template>
      <p v-if="projectController.error" class="forge-alert forge-alert--error" role="alert">{{ projectController.error }}</p>
    </div>
    <template #footer>
      <span class="website-help">Saving restarts Tomcat when it was running.</span>
      <div class="detail-actions">
        <button class="action-button" @click="emit('close')">Cancel</button>
        <button class="primary-button" :disabled="projectController.saving || scanning" @click="save">
          {{ projectController.saving ? 'Saving…' : 'Save website' }}
        </button>
      </div>
    </template>
  </ForgeDialog>
</template>

<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue'
import ForgeDialog from '../components/ForgeDialog.vue'
import { projectController } from '../state/projectController'
import { dialog, fs } from '@/util/NodeFn'
import { uuid } from '@/util/Index'
import {
  appBaseContextCandidates,
  cloneTomcatSiteHost,
  mergeAppBaseContextCandidates,
  type TomcatContextForm
} from '@/components/Host/Tomcat/site'
import type { WebsiteHost } from './types'

const props = defineProps<{original?: WebsiteHost}>()
const emit = defineEmits<{close: []}>()
const item = reactive(cloneTomcatSiteHost(props.original ?? { type: 'tomcat' }))
const scanning = ref(false)
const scanMessage = ref('')
let mounted = true

const scanAppBase = async () => {
  const root = item.root
  if (!root || scanning.value) return
  scanning.value = true
  scanMessage.value = ''
  try {
    const [directories, files] = await Promise.all([fs.subdir(root), fs.readdir(root, false)])
    if (!mounted || item.root !== root) return
    const candidates = appBaseContextCandidates(root, [
      ...directories.map((name) => ({ name, kind: 'directory' as const })),
      ...files.map((name) => ({ name, kind: 'war' as const }))
    ])
    const count = item.tomcat.contexts.length
    item.tomcat.contexts = mergeAppBaseContextCandidates(item.tomcat.contexts, candidates, () => uuid(12))
    const added = item.tomcat.contexts.length - count
    scanMessage.value = added ? `Added ${added} context mappings.` : 'No new mappings found.'
  } catch {
    if (mounted && item.root === root) scanMessage.value = 'Could not scan this directory. You can add mappings manually.'
  } finally {
    scanning.value = false
  }
}
const chooseRoot = async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory', 'showHiddenFiles'] })
  if (!canceled && filePaths[0]) {
    item.root = filePaths[0]
    await scanAppBase()
  }
}
const chooseDocBase = async (context: TomcatContextForm) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    defaultPath: context.docBase || item.root,
    properties: ['openFile', 'openDirectory', 'showHiddenFiles']
  })
  if (!canceled && filePaths[0]) context.docBase = filePaths[0]
}
const chooseSSL = async (field: 'cert' | 'key') => {
  const path = await projectController.choosePath(true, item.ssl[field])
  if (path) item.ssl[field] = path
}
const addContext = () => item.tomcat.contexts.push({ id: uuid(12), path: '/', docBase: '' })
const save = async () => {
  if (await projectController.save(item as WebsiteHost, props.original)) emit('close')
}
onBeforeUnmount(() => { mounted = false })
</script>

<style scoped>
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.context-row { display: grid; grid-template-columns: minmax(60px, 1fr) minmax(120px, 3fr) auto auto; gap: 7px; }
.section-head, .website-form label.switch-line { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.switch-line input { width: auto; }
</style>
