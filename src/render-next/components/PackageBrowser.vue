<template>
  <button class="action-button package-launcher" @click="open = true">Manage packages <span v-if="active">· {{ operation?.progress === undefined ? 'Working…' : Math.round(operation.progress) + '%' }}</span></button>
  <Teleport to="body">
    <div v-if="open" class="package-overlay" @keydown.esc.stop.prevent="close" @click.self="close">
      <section ref="dialog" class="package-dialog" role="dialog" aria-modal="true" aria-labelledby="package-title" tabindex="-1" @keydown.tab="trapFocus">
        <header class="package-dialog-header"><div><p class="eyebrow">WORKSPACE / PACKAGES</p><h2 id="package-title">Package library</h2><p>Download, install and manage local versions.</p></div><button class="package-close" aria-label="Close package library" @click="close">×</button></header>
        <div class="package-toolbar"><label>Package<select v-model="selectedFlag"><optgroup v-for="group in groups" :key="group" :label="group"><option v-for="item in modules.filter((item) => item.group === group)" :key="item.flag" :value="item.flag">{{ item.label }}</option></optgroup></select></label><label class="package-search"><span>Search</span><input v-model="query" placeholder="Version or channel" /></label><button class="action-button" :disabled="catalog.loading" @click="reload(true)">{{ catalog.loading ? 'Refreshing…' : 'Refresh' }}</button></div>
        <div class="package-tabs"><button :class="{ active: tab === 'available' }" @click="tab = 'available'">Available <span>{{ catalog.versions.length }}</span></button><button :class="{ active: tab === 'installed' }" @click="tab = 'installed'">Installed <span>{{ catalog.installed.length }}</span></button></div>
        <div v-if="catalog.error" class="package-alert package-alert--error" role="alert">{{ catalog.error }} <button class="text-button" :disabled="catalog.loading" @click="reload(true)">Try again</button></div>
        <p v-if="catalog.warning" class="package-alert" role="status">{{ catalog.warning }}</p>
        <div v-if="operation && operation.typeFlag === selectedFlag" class="package-operation" :class="'package-operation--' + operation.status" role="status"><div><b>{{ operation.action === 'install' ? 'Install' : 'Remove' }} {{ operation.version }}</b><span>{{ operation.progress === undefined ? '' : Math.round(operation.progress) + '%' }}</span></div><progress v-if="operation.status === 'running' && operation.progress !== undefined" :value="operation.progress" max="100" /><progress v-else-if="operation.status === 'running'" /><p>{{ operation.message }}</p></div>
        <div class="package-table" :aria-busy="catalog.loading">
          <p v-if="catalog.loading && !rows.length" class="empty-copy">Retrieving package versions…</p>
          <p v-else-if="!rows.length" class="empty-copy">{{ query ? 'No versions match your search.' : tab === 'installed' ? 'No installed versions detected.' : 'No direct-download versions are available for this platform.' }}</p>
          <div v-for="pkg in rows" :key="packageKey(pkg)" class="package-row"><div class="package-version"><b>{{ pkg.version }}</b><small>{{ tab === 'installed' ? pkg.bin : (pkg.channel || 'stable') }}<span v-if="pkg.downloaded"> · download cached</span></small></div><span class="package-tag">{{ pkg.installed ? 'Installed' : 'Available' }}</span><button v-if="pkg.installed" class="action-button" :disabled="busy" @click="askRemove(pkg)">Remove</button><button v-else class="action-button action-button--primary" :disabled="busy" @click="packageController.install(pkg)">{{ isActive(pkg) ? 'Installing…' : 'Install' }}</button></div>
        </div>
        <footer class="package-footer"><span>{{ provider?.label }} · {{ rows.length }} versions shown</span><span>Downloads continue when you close this window.</span></footer>
        <div v-if="pending" class="package-confirm-overlay" @keydown.esc.stop.prevent="pending = undefined"><section class="package-confirm-card" role="alertdialog" aria-labelledby="remove-title" aria-describedby="remove-description"><p class="eyebrow">PERMANENT REMOVAL</p><h3 id="remove-title">Remove {{ pending.version }}?</h3><p id="remove-description">The running version will be stopped. Its entire managed directory will be deleted. Back up any configuration and data in this directory first.</p><code>{{ directory?.path || pending.path || pending.appDir || pending.bin }}</code><p v-if="inspecting">Checking directory ownership…</p><p v-if="removeError" class="package-error" role="alert">{{ removeError }}</p><template v-if="directory"><label for="remove-phrase">Type <b>{{ FORCE_DELETE_CONFIRMATION }}</b> to confirm</label><input id="remove-phrase" v-model="confirmation" autocomplete="off" @keyup.enter="confirmRemove" /></template><div class="detail-actions"><button class="action-button" @click="pending = undefined">Cancel</button><button v-if="directory" class="action-button action-button--danger" :disabled="confirmation !== FORCE_DELETE_CONFIRMATION || busy" @click="confirmRemove">Remove permanently</button></div></section></div>
      </section>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { FORCE_DELETE_CONFIRMATION, type ManagedVersionDirectory } from '@shared/VersionDelete'
import { packageController } from '../state/packageController'
import { packageModules, packageModule } from '../packages/catalog'
import { packageKey, packageError, type PackageVersion } from '../packages/types'
import { inspectPackage } from '../adapters/packageAdapter'
const props = defineProps<{ flag?: string; title?: string }>()
defineExpose({ show: () => { open.value = true } })
const modules = packageModules
const groups = ['Runtimes', 'Services', 'Databases', 'Utilities'] as const
const open = ref(false); const selectedFlag = ref(props.flag || 'php'); const query = ref(''); const tab = ref<'available' | 'installed'>('available')
const dialog = ref<HTMLElement>(); let previousFocus: HTMLElement | null = null
const pending = ref<PackageVersion>(); const directory = ref<ManagedVersionDirectory>(); const confirmation = ref(''); const inspecting = ref(false); const removeError = ref(''); let inspectionSequence = 0
const catalog = computed(() => packageController.catalog(selectedFlag.value))
const provider = computed(() => packageModule(selectedFlag.value))
const operation = computed(() => packageController.operation)
const busy = computed(() => operation.value?.status === 'running' || operation.value?.status === 'unknown')
const active = computed(() => operation.value?.typeFlag === (props.flag || selectedFlag.value) && operation.value?.status === 'running')
const rows = computed(() => (tab.value === 'installed' ? catalog.value.installed : catalog.value.versions).filter((item) => (item.version + ' ' + (item.channel || '')).toLowerCase().includes(query.value.toLowerCase())))
const isActive = (item: PackageVersion) => operation.value?.key === packageKey(item) && operation.value?.status === 'running'
const reload = (fresh = false) => packageController.load(selectedFlag.value, fresh)
watch(open, async (value) => { if (value) { previousFocus = document.activeElement as HTMLElement; if (props.flag) selectedFlag.value = props.flag; void reload(); await nextTick(); dialog.value?.focus() } else { pending.value = undefined; previousFocus?.focus() } })
watch(selectedFlag, () => { query.value = ''; pending.value = undefined; if (open.value) void reload() })
watch(pending, () => { inspectionSequence += 1 })
const close = () => { open.value = false }
const askRemove = async (item: PackageVersion) => {
  pending.value = Object.freeze({ ...item }); directory.value = undefined; confirmation.value = ''; removeError.value = ''; inspecting.value = true
  await nextTick(); const sequence = inspectionSequence
  try { const result = await inspectPackage(item); if (sequence !== inspectionSequence) return; directory.value = result; if (!result) removeError.value = 'This directory is external, inaccessible, or not managed by this application. It cannot be removed here.' }
  catch (error) { if (sequence === inspectionSequence) removeError.value = packageError(error) }
  finally { if (sequence === inspectionSequence) { inspecting.value = false; await nextTick(); document.getElementById('remove-phrase')?.focus() } }
}
const confirmRemove = () => { if (!pending.value || !directory.value || confirmation.value !== FORCE_DELETE_CONFIRMATION || busy.value) return; void packageController.remove(pending.value, directory.value, confirmation.value); pending.value = undefined }
const trapFocus = (event: KeyboardEvent) => { const targets = dialog.value?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]'); if (!targets?.length) return; const first = pending.value ? dialog.value?.querySelector<HTMLElement>('.package-confirm-card input,.package-confirm-card button') : targets[0]; const last = targets[targets.length - 1]; if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.value)) { event.preventDefault(); last.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() } }
onBeforeUnmount(() => { inspectionSequence += 1 })
</script>
