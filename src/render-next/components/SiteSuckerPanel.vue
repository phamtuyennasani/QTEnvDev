<template>
  <ForgeDialog title="Site sucker" description="Mirror a site with explicit page, timeout and media limits." eyebrow="WORKSPACE / NETWORK" wide @close="emit('close')">
    <div class="form">
      <p v-if="!controller.settingsReady" class="forge-alert" role="status">{{ controller.settingsLoading ? 'Loading saved mirror settings…' : 'Mirror settings could not be loaded.' }} <button v-if="!controller.settingsLoading" class="action-button" @click="controller.init()">Retry</button></p>
      <fieldset class="mirror-controls" :disabled="!controller.settingsReady">
      <label>Start URL<input v-model="controller.url" placeholder="https://example.com" /></label>
      <div class="grid">
        <label>Output folder<input v-model="controller.config.dir" /><button class="action-button" @click="chooseDir">Choose folder</button></label>
        <label>Proxy<input v-model="controller.config.proxy" placeholder="Optional" /></label>
        <label>Page URL must include<input v-model="controller.config.pageLimit" placeholder="Optional legacy URL filter" /></label>
        <label>Maximum pages<input v-model.number="controller.config.maxPages" type="number" min="1" max="10000" /></label>
        <label>Timeout (ms)<input v-model.number="controller.config.timeout" type="number" min="1000" max="600000" /></label>
        <label>Max image (MB)<input v-model.number="controller.config.maxImgSize" type="number" min="1" max="2048" /></label>
        <label>Max video (MB)<input v-model.number="controller.config.maxVideoSize" type="number" min="1" max="4096" /></label>
        <label>Worker windows<input v-model.number="controller.config.windowCount" type="number" min="1" max="8" /></label>
        <label>Maximum attempts<input v-model.number="controller.config.maxRetryTimes" type="number" min="1" max="5" /></label>
        <label>Maximum files<input v-model.number="controller.config.maxFiles" type="number" min="1" max="10000" /></label>
        <label>Maximum file (MB)<input v-model.number="controller.config.maxFileSize" type="number" min="1" max="4096" /></label>
        <label>Maximum total (MB)<input v-model.number="controller.config.maxTotalSize" type="number" min="1" max="16384" /></label>
        <label>Maximum duration (ms)<input v-model.number="controller.config.maxDuration" type="number" min="1000" max="3600000" /></label>
        <label>Excluded hosts / URL substrings<textarea v-model="controller.config.excludeLink" placeholder="One host or substring per line" /></label>
      </div>
      <div class="actions"><button class="primary-button" :disabled="controller.running || controller.unknown" @click="controller.run()">{{ controller.running ? 'Mirroring…' : 'Start mirror' }}</button><button class="action-button" :disabled="!controller.running && !controller.unknown" @click="controller.cancel()">Cancel</button><button class="action-button" @click="controller.reconcile()">Refresh status</button><button class="action-button" @click="controller.saveConfig()">Save settings</button></div>
      <p class="status">{{ controller.status }} · {{ controller.links.filter((link) => ['success','replace','fail'].includes(link.state)).length }}/{{ controller.links.length }} terminal links</p>
      </fieldset>
      <p v-if="controller.error" class="forge-alert forge-alert--error">{{ controller.error }}</p>
      <p v-if="controller.warning" class="forge-alert">{{ controller.warning }}</p>
      <label>Search links<input v-model="search" /></label>
      <div class="links"><article v-for="link in filteredLinks" :key="link.url"><button class="text-button" @click="openLink(link.url)"><code>{{ link.url }}</code></button><em>{{ link.state }}<small v-if="link.reason"> · {{ link.reason }}</small></em></article><p v-if="!controller.links.length" class="empty-copy">Link progress appears here.</p></div>
      <label>Search hosts<input v-model="searchHost" /></label>
      <div class="links"><article v-for="host in filteredHosts" :key="host"><code>{{ host }}</code><button class="action-button" :aria-pressed="controller.config.excludeLink.split('\n').includes(host)" @click="controller.setExcludedHost(host)">{{ controller.config.excludeLink.split('\n').includes(host) ? 'Allow next run' : 'Exclude next run' }}</button></article></div>
    </div>
    <template #footer><span class="website-help">Page, timeout, file-size and worker limits are clamped before dispatch. Cancel destroys native workers and clears task state.</span></template>
  </ForgeDialog>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { dialog, shell } from '@/util/NodeFn'
import ForgeDialog from './ForgeDialog.vue'
import { siteSuckerController as controller } from '../state/siteSuckerController'
const emit = defineEmits(['close'])
const search = ref(''); const searchHost = ref('')
const filteredLinks = computed(() => controller.links.filter((link) => link.url.toLowerCase().includes(search.value.toLowerCase())))
const filteredHosts = computed(() => [...new Set(controller.links.flatMap((link) => { try { return [new URL(link.url).host] } catch { return [] } }))].filter((host) => host.includes(searchHost.value)))
const chooseDir = async () => { const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] }); if (!result.canceled && result.filePaths?.[0]) controller.config.dir = result.filePaths[0] }
const openLink = async (url: string) => { try { await shell.openExternal(url) } catch (error) { controller.warning = `The URL could not be opened: ${String(error)}` } }
onMounted(() => controller.init())
</script>
<style scoped>
.mirror-controls{display:grid;gap:14px;min-width:0;margin:0;padding:0;border:0}
.form{display:grid;gap:14px}.form label{display:grid;gap:6px;color:var(--pqt-text-muted);font-size:11px}.form input{min-width:0;padding:9px;color:var(--pqt-text);background:var(--pqt-canvas);border:1px solid var(--pqt-border);border-radius:7px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.actions{display:flex;gap:8px}.status{color:var(--pqt-accent)}.links{display:grid;gap:5px;max-height:250px;overflow:auto}.links article{display:flex;justify-content:space-between;gap:8px;padding:8px;border:1px solid var(--pqt-border);border-radius:6px}.links code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.links em{color:var(--pqt-accent);font-style:normal}
</style>
