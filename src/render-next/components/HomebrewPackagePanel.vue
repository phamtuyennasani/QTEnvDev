<template>
  <div class="brew-panel" :aria-busy="catalog.loading">
    <div v-if="bootstrap.phase !== 'idle'" class="brew-status">
      <b role="status">{{ bootstrapStatus }}</b>
      <p v-if="bootstrap.error" role="alert">{{ bootstrap.error }}</p>
      <p v-if="bootstrap.discoveryError" role="alert">
        Homebrew discovery failed. {{ bootstrap.discoveryError }}
      </p>
      <p v-if="bootstrap.terminalError" role="alert">{{ bootstrap.terminalError }}</p>
      <p v-if="bootstrap.canStop">Follow the prompts in the terminal to continue.</p>
      <div v-if="bootstrap.showTerminal" ref="terminalElement" class="brew-terminal" aria-label="Homebrew installer terminal" />
      <button v-if="bootstrap.canStop" class="action-button" @click="bootstrap.cancel()">Cancel installation</button>
      <button v-if="bootstrap.discoveryError" class="action-button" :disabled="bootstrap.busy" @click="bootstrap.retryDiscovery()">Check for Homebrew again</button>
    </div>
    <template v-if="!controller.available">
      <p v-if="!bootstrap.busy && !bootstrap.discoveryError">Homebrew is not available. {{ server.BrewError || 'Install Homebrew to browse its formulae.' }}</p>
      <div class="brew-actions">
        <button
          v-if="bootstrap.permitted && !bootstrap.busy && !bootstrap.discoveryError"
          class="action-button action-button--primary"
          :disabled="mutationBusy"
          @click="bootstrap.start()"
        >Install Homebrew</button>
        <button class="action-button" @click="controller.openInstallGuide()">Homebrew installation guide</button>
      </div>
    </template>
    <template v-else>
      <div v-if="controller.operationFlag === flag && (brew.busy || brew.result)" class="brew-status" role="status">
        <b>{{ status }}</b>
        <p v-if="brew.error">{{ brew.error }}</p>
        <p v-if="brew.refreshFailed">The package change completed. The installed versions could not be refreshed.</p>
        <details v-if="brew.logs">
          <summary>Homebrew output</summary>
          <pre>{{ brew.logs }}</pre>
        </details>
      </div>
      <p v-if="catalog.error" class="forge-alert forge-alert--error" role="alert">{{ catalog.error }}</p>
      <p v-if="catalog.warning" class="forge-alert" role="status">{{ catalog.warning }}</p>
      <div v-if="preview || removal" class="brew-status" role="group" aria-label="Confirm Homebrew change">
        <template v-if="preview">
          <b>Upgrade {{ preview.snapshot.formula }}?</b>
          <p>{{ preview.snapshot.installedVersions.join(', ') }} → {{ preview.snapshot.availableVersion }}</p>
          <p v-if="changesSeries">This upgrade changes the PHP major or minor version.</p>
          <p v-if="preview.targets.length">QTEnvDev will stop these services before upgrading:</p>
          <ul v-if="preview.targets.length">
            <li v-for="target in preview.targets" :key="target.module + ':' + target.item.pid">
              {{ target.module }} {{ target.item.version }} · {{ target.item.bin }}
            </li>
          </ul>
          <p>Stopped services stay stopped after the upgrade.</p>
        </template>
        <b v-else>Uninstall {{ removal?.name }} with Homebrew?</b>
        <div class="detail-actions">
          <button class="action-button" @click="clearConfirmation">Cancel</button>
          <button class="action-button action-button--primary" :disabled="blocked" @click="confirm">
            {{ preview ? 'Confirm upgrade' : 'Confirm uninstall' }}
          </button>
        </div>
      </div>
      <div v-if="tap" class="brew-tap">
        <span>{{ tap }}</span>
        <button
          class="action-button"
          :disabled="mutationBusy || controller.tapBlocked(flag)"
          @click="controller.enableTap(flag)"
        >{{ controller.tapBlocked(flag) ? 'Tap status unknown' : 'Enable tap' }}</button>
      </div>
      <p v-if="catalog.loading && !rows.length" class="empty-copy">Retrieving Homebrew formulae…</p>
      <p v-else-if="!rows.length && !catalog.error" class="empty-copy">
        {{ query ? 'No formulae match your search.' : 'No formulae were returned for this package.' }}
      </p>
      <div v-for="row in rows" :key="row.name" class="brew-row">
        <div class="brew-formula">
          <b>{{ row.name }}</b>
          <small v-if="row.version">Available {{ row.version }}</small>
          <small v-if="info(row)?.installedVersions.length">Installed {{ info(row)?.installedVersions.join(', ') }}</small>
          <small v-else-if="row.installed">Installed</small>
          <small v-if="conflict(row)">Conflicts with installed formula {{ conflict(row) }}</small>
          <small v-if="info(row)?.reason">{{ upgradeReason(row) }}</small>
        </div>
        <div class="brew-actions">
          <button
            v-if="info(row)?.outdated"
            class="action-button"
            :disabled="blocked || !info(row)?.eligible"
            @click="prepare(row)"
          >Upgrade</button>
          <button
            class="action-button"
            :class="{ 'action-button--primary': !row.installed }"
            :disabled="blocked || Boolean(conflict(row))"
            @click="row.installed ? removal = row : controller.change(flag, row.name, false)"
          >{{ row.installed ? 'Uninstall' : 'Install' }}</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { I18nT } from '@lang/index'
import { homebrewUpgrade as brew } from '@/components/VersionManager/brew/Controller'
import { findInstalledFormulaConflict } from '@/components/VersionManager/brew/FormulaConflict'
import type { BrewUpgradePreview } from '@fork/module/Brew/UpgradeTypes'
import { homebrewTaps } from '../packages/homebrewSources'
import { homebrewPackages as controller, type HomebrewFormula } from '../state/homebrewPackagesController'
import { homebrewBootstrap as bootstrap } from '../state/homebrewBootstrapController'

const props = defineProps<{ flag: string; query: string; directBusy: boolean }>()
const server = window.Server
const removal = ref<HomebrewFormula>()
const preview = ref<BrewUpgradePreview>()
let mounted = true
const catalog = computed(() => controller.catalog(props.flag))
const terminalElement = ref<HTMLElement>()
const bootstrapStatus = computed(() => ({
  idle: '',
  starting: 'Opening the Homebrew installer…',
  running: 'Homebrew installation is running.',
  stopping: 'Stopping the Homebrew installer…',
  detecting: 'Checking for Homebrew…',
  succeeded: bootstrap.discoveryError ? 'The installer completed.' : 'Homebrew is available.',
  failed: 'Homebrew installation failed.',
  cancelled: 'Homebrew installation cancelled.'
}[bootstrap.phase]))
watch([terminalElement, () => bootstrap.phase === 'starting'], ([element], [previous]) => {
  if (previous && previous !== element) bootstrap.detach(previous)
  if (element) void bootstrap.attach(element)
}, { flush: 'post' })
const mutationBusy = computed(() => props.directBusy || controller.busy || catalog.value.loading)
const blocked = computed(() => mutationBusy.value || Boolean(catalog.value.error))
const tap = computed(() => homebrewTaps[props.flag])
const rows = computed(() => {
  const query = props.query.trim().toLowerCase()
  return catalog.value.rows.filter((row) => (row.name + ' ' + row.version).toLowerCase().includes(query))
})
const info = (row: HomebrewFormula) => props.flag === 'php' && server.isMacOS ? brew.catalog[row.name] : undefined
const conflict = (row: HomebrewFormula) => findInstalledFormulaConflict(row, catalog.value.rows)
const upgradeReason = (row: HomebrewFormula) => I18nT('versionmanager.brewUpgradeReason.' + info(row)?.reason)
const changesSeries = computed(() => {
  const snapshot = preview.value?.snapshot
  if (!snapshot) return false
  const series = (version: string) => version.split('.').slice(0, 2).join('.')
  return snapshot.installedVersions.some((version) => series(version) !== series(snapshot.availableVersion))
})
const status = computed(() => {
  if (brew.phase === 'unknown') return 'Homebrew result unknown. Check the installation before retrying.'
  if (brew.phase === 'checking') return 'Checking Homebrew…'
  if (brew.phase === 'stopping') return 'Stopping affected services…'
  if (brew.phase === 'refreshing') return 'Refreshing installed versions…'
  if (brew.busy) return 'Homebrew is working…'
  return brew.result?.outcome === 'succeeded' ? 'Homebrew operation completed.' : 'Homebrew operation failed.'
})
const clearConfirmation = () => { preview.value = undefined; removal.value = undefined }
const prepare = async (row: HomebrewFormula) => {
  clearConfirmation()
  const selection = props.flag
  const result = await controller.prepareUpgrade(row.name)
  if (mounted && props.flag === selection) preview.value = result
}
const confirm = () => {
  if (blocked.value) return
  if (preview.value) void controller.upgrade(preview.value)
  else if (removal.value) void controller.change(props.flag, removal.value.name, true)
  clearConfirmation()
}
watch(() => props.flag, clearConfirmation)
onBeforeUnmount(() => {
  mounted = false
  if (terminalElement.value) bootstrap.detach(terminalElement.value)
})
</script>

<style scoped>
.brew-panel { padding-top: 12px; }
.brew-status { margin-bottom: 12px; padding: 12px; border: 1px solid var(--pqt-border); border-radius: 7px; overflow-wrap: anywhere; }
.brew-status p, .brew-status details { margin: 8px 0; }
.brew-status pre { max-height: 160px; overflow: auto; white-space: pre-wrap; }
.brew-terminal { height: 240px; margin: 8px 0; padding: 8px; overflow: hidden; background: #282b3d; border-radius: 5px; }
.brew-tap, .brew-row, .brew-actions { display: flex; align-items: center; gap: 8px; }
.brew-tap, .brew-row { justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--pqt-border); }
.brew-formula { min-width: 0; overflow-wrap: anywhere; }
.brew-formula small { display: block; margin-top: 3px; color: var(--pqt-text-muted); }
</style>
