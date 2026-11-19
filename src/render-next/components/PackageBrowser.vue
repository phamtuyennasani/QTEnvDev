<template>
  <button class="action-button package-launcher" @click="show()"
    >Manage packages
    <span v-if="active"
      >·
      {{
        operation?.progress === undefined ? 'Working…' : Math.round(operation.progress) + '%'
      }}</span
    ></button
  >
  <Teleport to="body">
    <div v-if="open" class="package-overlay" @keydown.esc.stop.prevent="close" @click.self="close">
      <section
        ref="dialog"
        class="package-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="package-title"
        tabindex="-1"
        @keydown.tab="trapFocus"
      >
        <header class="package-dialog-header"
          ><div
            ><p class="eyebrow">WORKSPACE / PACKAGES</p><h2 id="package-title">Package library</h2
            ><p>Download, install and manage local versions.</p></div
          ><button class="package-close" aria-label="Close package library" @click="close"
            >×</button
          ></header
        >
        <div class="package-toolbar">
          <label
            >Package<select
              :value="selectedFlag"
              @change="selectPackage(($event.target as HTMLSelectElement).value)"
            >
              <optgroup v-for="group in groups" :key="group" :label="group">
                <option
                  v-for="item in modules.filter((item) => item.group === group)"
                  :key="item.flag"
                  :value="item.flag"
                  >{{ item.label }}</option
                >
              </optgroup>
            </select></label
          >
          <label class="package-search"
            ><span>Search</span
            ><input
              v-model="query"
              :placeholder="usingHomebrew ? 'Formula or version' : usingMacPorts ? 'Port or version' : 'Version or channel'"
          /></label>
          <button
            class="action-button"
            :disabled="loading || (usingHomebrew && !homebrewPackages.available) || (usingMacPorts && !macportsPackages.available)"
            @click="reload(true)"
            >{{ loading ? 'Refreshing…' : 'Refresh' }}</button
          >
        </div>
        <div
          v-if="hasHomebrew || hasMacPorts || hasSdkman"
          class="package-tabs"
          role="group"
          aria-label="Package source"
        >
          <button
            :class="{ active: source === 'direct' }"
            :aria-pressed="source === 'direct'"
            @click="source = 'direct'"
            >Direct download</button
          >
          <button
            v-if="hasHomebrew"
            :class="{ active: source === 'brew' }"
            :aria-pressed="source === 'brew'"
            @click="source = 'brew'"
            >Homebrew</button
          >
          <button
            v-if="hasMacPorts"
            :class="{ active: source === 'macports' }"
            :aria-pressed="source === 'macports'"
            @click="source = 'macports'"
            >MacPorts</button
          >
          <button
            v-if="hasSdkman"
            :class="{ active: source === 'sdkman' }"
            :aria-pressed="source === 'sdkman'"
            @click="source = 'sdkman'"
            >SDKMAN!</button
          >
        </div>
        <div v-if="usingHomebrew" class="package-table">
          <HomebrewPackagePanel
            :key="selectedFlag"
            :flag="selectedFlag"
            :query="query"
            :direct-busy="directBusy || macportsPackages.busy || sdkmanPackages.busy"
          />
        </div>
        <div v-else-if="usingMacPorts" class="package-table">
          <MacPortsPackagePanel
            :key="selectedFlag"
            :flag="selectedFlag"
            :query="query"
            :other-source-busy="directBusy || homebrewPackages.busy || sdkmanPackages.busy"
          />
        </div>
        <div v-else-if="usingSdkman" class="package-table">
          <SdkmanPackagePanel
            :key="selectedFlag"
            :flag="selectedFlag as 'java' | 'maven' | 'gradle'"
            :query="query"
            :other-source-busy="directBusy || homebrewPackages.busy || macportsPackages.busy"
          />
        </div>
        <template v-else>
          <div class="package-tabs"
            ><button :class="{ active: tab === 'available' }" @click="tab = 'available'"
              >Available
              <span>{{
                catalog.loading && !catalog.versions.length ? '…' : catalog.versions.length
              }}</span></button
            ><button :class="{ active: tab === 'installed' }" @click="tab = 'installed'"
              >Installed
              <span>{{
                catalog.loading && !catalog.installed.length ? '…' : catalog.installed.length
              }}</span></button
            ></div
          >
          <div v-if="catalog.error" class="package-alert package-alert--error" role="alert"
            >{{ catalog.error }}
            <button class="text-button" :disabled="catalog.loading" @click="reload(true)"
              >Try again</button
            ></div
          >
          <p v-if="catalog.warning" class="package-alert" role="status">{{ catalog.warning }}</p>
          <div
            v-if="operation && operation.typeFlag === selectedFlag"
            class="package-operation"
            :class="'package-operation--' + operation.status"
            role="status"
            ><div
              ><b
                >{{ operation.action === 'install' ? 'Install' : 'Remove' }}
                {{ operation.version }}</b
              ><span>{{
                operation.progress === undefined ? '' : Math.round(operation.progress) + '%'
              }}</span></div
            ><progress
              v-if="operation.status === 'running' && operation.progress !== undefined"
              :value="operation.progress"
              max="100"
            /><progress v-else-if="operation.status === 'running'" /><p>{{
              operation.message
            }}</p></div
          >
          <div class="package-table" :aria-busy="catalog.loading">
            <p v-if="catalog.loading && !rows.length" class="empty-copy"
              >Retrieving package versions…</p
            >
            <p v-else-if="!rows.length" class="empty-copy">{{
              query
                ? 'No versions match your search.'
                : tab === 'installed'
                  ? 'No installed versions detected.'
                  : 'No direct-download versions are available for this platform.'
            }}</p>
            <div v-for="pkg in rows" :key="packageKey(pkg)" class="package-row"
              ><div class="package-version"
                ><b>{{ pkg.version }}</b
                ><small
                  >{{ tab === 'installed' ? pkg.bin : pkg.channel || 'stable'
                  }}<span v-if="pkg.downloaded"> · download cached</span></small
                ></div
              ><span class="package-tag">{{ pkg.installed ? 'Installed' : 'Available' }}</span
              ><button
                v-if="pkg.installed"
                class="action-button"
                :disabled="busy"
                @click="askRemove(pkg)"
                >Remove</button
              ><button
                v-else
                class="action-button action-button--primary"
                :disabled="busy"
                @click="packageController.install(pkg)"
                >{{ isActive(pkg) ? 'Installing…' : 'Install' }}</button
              ></div
            >
          </div>
          <footer class="package-footer"
            ><span>{{ provider?.label }} · {{ rows.length }} versions shown</span
            ><span>Downloads continue when you close this window.</span></footer
          >
        </template>
        <div
          v-if="pending"
          class="package-confirm-overlay"
          @keydown.esc.stop.prevent="pending = undefined"
          ><section
            class="package-confirm-card"
            role="alertdialog"
            aria-labelledby="remove-title"
            aria-describedby="remove-description"
            ><p class="eyebrow">PERMANENT REMOVAL</p
            ><h3 id="remove-title">Remove {{ pending.version }}?</h3
            ><p id="remove-description"
              >The running version will be stopped. Its entire managed directory will be deleted.
              Back up any configuration and data in this directory first.</p
            ><code>{{ directory?.path || pending.path || pending.appDir || pending.bin }}</code
            ><p v-if="inspecting">Checking directory ownership…</p
            ><p v-if="removeError" class="package-error" role="alert">{{ removeError }}</p
            ><template v-if="directory"
              ><label for="remove-phrase"
                >Type <b>{{ FORCE_DELETE_CONFIRMATION }}</b> to confirm</label
              ><input
                id="remove-phrase"
                v-model="confirmation"
                autocomplete="off"
                @keyup.enter="confirmRemove" /></template
            ><div class="detail-actions"
              ><button class="action-button" @click="pending = undefined">Cancel</button
              ><button
                v-if="directory"
                class="action-button action-button--danger"
                :disabled="confirmation !== FORCE_DELETE_CONFIRMATION || busy"
                @click="confirmRemove"
                >Remove permanently</button
              ></div
            ></section
          ></div
        >
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
  import { supportsHomebrew } from '../packages/homebrewSources'
  import { supportsMacPorts } from '../packages/macportsSources'
  import { supportsSdkman } from '../packages/sdkmanSources'
  import { homebrewPackages } from '../state/homebrewPackagesController'
  import { homebrewBootstrap } from '../state/homebrewBootstrapController'
  import HomebrewPackagePanel from './HomebrewPackagePanel.vue'
  import { macportsPackages } from '../state/macportsPackagesController'
  import MacPortsPackagePanel from './MacPortsPackagePanel.vue'
  import SdkmanPackagePanel from './SdkmanPackagePanel.vue'
  import { sdkmanPackages } from '../state/sdkmanPackagesController'
  const props = defineProps<{ flag?: string; title?: string }>()
  const modules = packageModules
  const groups = ['Runtimes', 'Services', 'Databases', 'Utilities'] as const
  const open = ref(false)
  const selectedFlag = ref(props.flag || 'php')
  const show = (flag?: string) => {
    if (flag && modules.some((item) => item.flag === flag)) selectPackage(flag)
    else if (props.flag) selectedFlag.value = props.flag
    open.value = true
  }
  defineExpose({ show })
  const query = ref('')
  const tab = ref<'available' | 'installed'>('available')
  const source = ref<'direct' | 'brew' | 'macports' | 'sdkman'>('direct')
  const dialog = ref<HTMLElement>()
  let previousFocus: HTMLElement | null = null
  const pending = ref<PackageVersion>()
  const directory = ref<ManagedVersionDirectory>()
  const confirmation = ref('')
  const inspecting = ref(false)
  const removeError = ref('')
  let inspectionSequence = 0
  const catalog = computed(() => packageController.catalog(selectedFlag.value))
  const provider = computed(() => packageModule(selectedFlag.value))
  const operation = computed(() => packageController.operation)
  const directBusy = computed(
    () => operation.value?.status === 'running' || operation.value?.status === 'unknown'
  )
  const busy = computed(() => directBusy.value || homebrewPackages.busy || macportsPackages.busy || sdkmanPackages.busy)
  const hasHomebrew = computed(() => supportsHomebrew(selectedFlag.value, window.Server))
  const hasMacPorts = computed(() => supportsMacPorts(selectedFlag.value, window.Server))
  const hasSdkman = computed(() => supportsSdkman(selectedFlag.value, window.Server))
  const usingHomebrew = computed(() => hasHomebrew.value && source.value === 'brew')
  const usingMacPorts = computed(() => hasMacPorts.value && source.value === 'macports')
  const usingSdkman = computed(() => hasSdkman.value && source.value === 'sdkman')
  const loading = computed(() =>
    usingHomebrew.value
      ? homebrewPackages.catalog(selectedFlag.value).loading
      : usingMacPorts.value
        ? macportsPackages.catalog(selectedFlag.value).loading
        : usingSdkman.value
          ? sdkmanPackages.catalog(selectedFlag.value as 'java' | 'maven' | 'gradle').loading
          : catalog.value.loading
  )
  const active = computed(
    () =>
      operation.value?.typeFlag === (props.flag || selectedFlag.value) &&
      operation.value?.status === 'running'
  )
  const rows = computed(() =>
    (tab.value === 'installed' ? catalog.value.installed : catalog.value.versions).filter((item) =>
      (item.version + ' ' + (item.channel || '')).toLowerCase().includes(query.value.toLowerCase())
    )
  )
  const isActive = (item: PackageVersion) =>
    operation.value?.key === packageKey(item) && operation.value?.status === 'running'
  const reload = (fresh = false) =>
    usingHomebrew.value
      ? homebrewPackages.load(selectedFlag.value)
      : usingMacPorts.value
        ? macportsPackages.load(selectedFlag.value)
        : usingSdkman.value
          ? sdkmanPackages.load(selectedFlag.value as 'java' | 'maven' | 'gradle', fresh)
          : packageController.load(selectedFlag.value, fresh)
  const selectPackage = (flag: string) => {
    tab.value = 'available'
    selectedFlag.value = flag
  }
  watch(open, async (value) => {
    if (value) {
      previousFocus = document.activeElement as HTMLElement
      if (
        hasHomebrew.value &&
        (homebrewPackages.operationFlag === selectedFlag.value || homebrewBootstrap.busy)
      ) {
        source.value = 'brew'
      }
      const portWork = macportsPackages.operation
      if (macportsPackages.busy && portWork && supportsMacPorts(portWork.flag, window.Server)) {
        selectedFlag.value = portWork.flag
        source.value = 'macports'
      }
      if (hasSdkman.value && sdkmanPackages.busy) source.value = 'sdkman'
      await nextTick()
      dialog.value?.focus()
    } else {
      pending.value = undefined
      previousFocus?.focus()
    }
  })
  watch(
    [
      open,
      selectedFlag,
      usingHomebrew,
      usingMacPorts,
      usingSdkman,
      () => usingHomebrew.value && homebrewPackages.available,
      () => usingMacPorts.value && macportsPackages.available,
      () => usingSdkman.value && sdkmanPackages.available
    ],
    ([visible]) => {
      if (visible) void reload()
    }
  )
  watch([selectedFlag, source], () => {
    query.value = ''
    pending.value = undefined
  })
  watch([hasHomebrew, hasMacPorts, hasSdkman], () => {
    if (source.value === 'brew' && !hasHomebrew.value) source.value = 'direct'
    if (source.value === 'macports' && !hasMacPorts.value) source.value = 'direct'
    if (source.value === 'sdkman' && !hasSdkman.value) source.value = 'direct'
  })
  watch(pending, () => {
    inspectionSequence += 1
  })
  const close = () => {
    open.value = false
  }
  const askRemove = async (item: PackageVersion) => {
    pending.value = Object.freeze({ ...item })
    directory.value = undefined
    confirmation.value = ''
    removeError.value = ''
    inspecting.value = true
    await nextTick()
    const sequence = inspectionSequence
    try {
      const result = await inspectPackage(item)
      if (sequence !== inspectionSequence) return
      directory.value = result
      if (!result)
        removeError.value =
          'This directory is external, inaccessible, or not managed by this application. It cannot be removed here.'
    } catch (error) {
      if (sequence === inspectionSequence) removeError.value = packageError(error)
    } finally {
      if (sequence === inspectionSequence) {
        inspecting.value = false
        await nextTick()
        document.getElementById('remove-phrase')?.focus()
      }
    }
  }
  const confirmRemove = () => {
    if (
      !pending.value ||
      !directory.value ||
      confirmation.value !== FORCE_DELETE_CONFIRMATION ||
      busy.value
    )
      return
    void packageController.remove(pending.value, directory.value, confirmation.value)
    pending.value = undefined
  }
  const trapFocus = (event: KeyboardEvent) => {
    const targets = dialog.value?.querySelectorAll<HTMLElement>(
      'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]'
    )
    if (!targets?.length) return
    const first = pending.value
      ? dialog.value?.querySelector<HTMLElement>(
          '.package-confirm-card input,.package-confirm-card button'
        )
      : targets[0]
    const last = targets[targets.length - 1]
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === dialog.value)
    ) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }
  onBeforeUnmount(() => {
    inspectionSequence += 1
  })
</script>
<style scoped>
  .package-overlay {
    position: fixed;
    inset: 0;
    z-index: 140;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgb(3 8 11 / 0.78);
    backdrop-filter: blur(5px);
  }
  .package-dialog {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(760px, calc(100vw - 48px));
    max-height: calc(100vh - 48px);
    overflow: hidden;
    border: 1px solid var(--pqt-border-strong);
    border-radius: 14px;
    background: var(--pqt-surface);
    box-shadow: 0 24px 80px #0009;
    outline: none;
  }
  .package-dialog-header {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    padding: 20px 22px 16px;
    border-bottom: 1px solid var(--pqt-border);
  }
  .package-dialog-header h2 {
    margin: 0;
    font-size: 20px;
  }
  .package-dialog-header p:not(.eyebrow) {
    margin: 7px 0 0;
    color: var(--pqt-text-muted);
    font-size: 12px;
  }
  .package-close {
    flex: 0 0 30px;
    height: 30px;
    border: 1px solid var(--pqt-border);
    border-radius: 7px;
    color: var(--pqt-text-muted);
    background: transparent;
    font-size: 22px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .package-dialog > *:not(.package-table) {
    flex-shrink: 0;
  }
  .package-toolbar {
    display: grid;
    grid-template-columns: 150px 1fr auto;
    gap: 10px;
    padding: 14px 22px 10px;
  }
  .package-toolbar label {
    display: grid;
    gap: 6px;
    color: var(--pqt-text-muted);
    font-size: 10px;
  }
  .package-toolbar select,
  .package-search input {
    min-width: 0;
    padding: 9px 10px;
    border: 1px solid var(--pqt-border-strong);
    border-radius: 7px;
    color: var(--pqt-text);
    background: var(--pqt-canvas);
    font: 11px var(--pqt-font-mono);
  }
  .package-search {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 8px;
  }
  .package-search input {
    width: 100%;
  }
  .package-tabs {
    display: flex;
    gap: 6px;
    padding: 0 22px 10px;
    border-bottom: 1px solid var(--pqt-border);
  }
  .package-tabs button {
    padding: 7px 10px;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--pqt-text-muted);
    background: transparent;
    cursor: pointer;
    font-size: 10px;
  }
  .package-tabs button.active {
    border-color: var(--pqt-border-strong);
    color: var(--pqt-text);
    background: var(--pqt-surface-hover);
  }
  .package-alert,
  .package-operation {
    margin: 10px 22px 0;
    padding: 9px;
    border: 1px solid var(--pqt-border);
    border-radius: 7px;
    color: var(--pqt-text-muted);
    font-size: 10px;
  }
  .package-alert--error {
    border-color: #784848;
    color: #ffb5b5;
  }
  .package-table {
    min-height: 0;
    overflow: auto;
    padding: 0 22px 14px;
  }
  .package-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 10px;
    align-items: center;
    padding: 10px 0;
    border-top: 1px solid var(--pqt-border);
  }
  .package-version b,
  .package-version small {
    display: block;
  }
  .package-version small {
    margin-top: 3px;
    color: var(--pqt-text-muted);
    font: 9px var(--pqt-font-mono);
  }
  .package-tag {
    color: var(--pqt-text-muted);
    font-size: 10px;
  }
  .package-footer {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 22px;
    border-top: 1px solid var(--pqt-border);
    color: var(--pqt-text-muted);
    font-size: 9px;
  }
  .package-confirm-overlay {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgb(3 8 11 / 0.72);
  }
  .package-confirm-card {
    width: min(420px, 100%);
    padding: 20px;
    border: 1px solid #614b4b;
    border-radius: 12px;
    background: var(--pqt-surface);
    box-shadow: var(--pqt-shadow);
  }
  .package-confirm-card h3 {
    margin: 0 0 8px;
    font-size: 16px;
  }
  .package-confirm-card p:not(.eyebrow) {
    color: var(--pqt-text-muted);
    font-size: 10px;
    line-height: 1.5;
  }
  .package-confirm-card code {
    display: block;
    margin: 12px 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>

<style scoped>
  .package-toolbar {
    grid-template-columns: 220px minmax(0, 1fr) 120px;
    align-items: end;
    gap: 12px;
    padding-top: 16px;
  }
  .package-toolbar > label {
    min-width: 0;
  }
  .package-toolbar > label > select {
    height: 44px;
  }
  .package-toolbar .package-search {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  .package-toolbar .package-search > span {
    color: var(--pqt-text-muted);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .package-toolbar .package-search > input {
    height: 44px;
    box-sizing: border-box;
  }
  .package-toolbar > .action-button {
    height: 44px;
    justify-content: center;
  }
</style>
