<template>
  <section class="screen settings-screen">
    <header class="page-header">
      <div>
        <p class="eyebrow">WORKSPACE / SETTINGS</p>
        <h1>Settings</h1>
      </div>
    </header>
    <div class="settings-layout">
      <nav class="settings-nav" aria-label="Settings sections">
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          :class="{ active: activeSection === section.id }"
          :aria-current="activeSection === section.id ? 'page' : undefined"
          @click="activeSection = section.id"
        >
          <span aria-hidden="true">{{ section.glyph }}</span> {{ section.label }}
        </button>
      </nav>
      <article class="panel settings-panel">
        <h2>{{ activeLabel }}</h2>
        <template v-if="activeSection === 'environment'">
          <label for="settings-path">System PATH</label>
          <div class="path-toolbar">
            <button class="action-button" :disabled="!desktop || pathBusy" @click="path.load()">Refresh</button>
            <input id="settings-path" v-model="newPath" placeholder="Add absolute folder path" :disabled="!desktop || pathBusy" @keyup.enter="addPath" />
            <button class="action-button" :disabled="!desktop || pathBusy || !newPath.trim()" @click="addPath">Add</button>
          </div>
          <div class="path-list">
            <div v-for="(entry, index) in path.state.list" :key="entry.path + index" class="path-row">
              <code>{{ entry.path }}</code>
              <button class="icon-button" :aria-label="'Remove ' + entry.path" :disabled="pathBusy" @click="path.remove(index)">×</button>
            </div>
          </div>
          <p v-if="path.state.error" class="muted" role="status">{{ path.state.error }}</p>
          <button class="action-button settings-submit" :disabled="!desktop || pathBusy" @click="path.save()">Save PATH</button>
        </template>
        <template v-else-if="activeSection === 'hosts'">
          <label for="settings-hosts">System hosts file</label>
          <div class="path-toolbar">
            <button class="action-button" :disabled="!desktop || hostsBusy" @click="hosts.load()">Refresh</button>
          </div>
          <textarea id="settings-hosts" v-model="hosts.state.content" class="hosts-editor" spellcheck="false" :disabled="!hosts.state.digest || hostsBusy" />
          <p v-if="hosts.state.error" class="muted" role="status">{{ hosts.state.error }}</p>
          <button class="action-button settings-submit" :disabled="!desktop || !hosts.state.digest || hostsBusy" @click="hosts.save()">Save hosts</button>
        </template>
        <CustomModulesSettings v-else-if="activeSection === 'custom-modules'" />
        <MacOSMirrorSettings v-else-if="activeSection === 'package-mirrors' && showPackageMirrors" />
        <p v-else-if="activeSection === 'package-mirrors'" class="muted">Package mirrors are available on macOS.</p>
        <BuiltinModulesSettings v-else-if="activeSection === 'modules' && desktop" />
        <p v-else-if="activeSection === 'modules'" class="muted">Open the desktop app to manage modules.</p>
        <EstablishedSettingsPanel v-else-if="desktop" :section="activeSection" />
        <p v-else class="muted">Open the desktop app to manage these settings.</p>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
  import { computed, defineAsyncComponent, ref, watch } from 'vue'
  import CustomModulesSettings from '../custom-modules/CustomModulesSettings.vue'
  import { pathController } from '../state/pathController'
  import { hostsController } from '../state/hostsController'

  const EstablishedSettingsPanel = defineAsyncComponent(
    () => import('../components/EstablishedSettingsPanel.vue')
  )
  const BuiltinModulesSettings = defineAsyncComponent(
    () => import('../moduleVisibility/BuiltinModulesSettings.vue')
  )
  const MacOSMirrorSettings = defineAsyncComponent(() => import('../components/MacOSMirrorSettings.vue'))
  const allSections = [
    { id: 'general', label: 'General', glyph: '⚙' },
    { id: 'environment', label: 'Environment', glyph: '⌁' },
    { id: 'hosts', label: 'Hosts', glyph: '↔' },
    { id: 'modules', label: 'Modules', glyph: '◉' },
    { id: 'package-mirrors', label: 'Package mirrors', glyph: '⇄' },
    { id: 'custom-modules', label: 'Custom modules', glyph: '⊞' },
    { id: 'editors', label: 'Editors', glyph: '◐' },
    { id: 'licenses', label: 'Licenses', glyph: '◇' },
    { id: 'about', label: 'About PQT Forge', glyph: 'i' }
  ] as const

  const desktop = Boolean(window.QTEnvDevNodeAPI)
  const showPackageMirrors = computed(() => desktop && window.Server?.isMacOS === true)
  const sections = computed(() => allSections.filter((section) => section.id !== 'package-mirrors' || showPackageMirrors.value))
  const activeSection = ref<(typeof allSections)[number]['id']>('general')
  const activeLabel = computed(() => allSections.find((section) => section.id === activeSection.value)?.label)
  const newPath = ref('')
  const path = pathController
  const hosts = hostsController
  const pathBusy = computed(() => path.state.loading || path.state.saving)
  const hostsBusy = computed(() => hosts.state.loading || hosts.state.saving)

  const addPath = () => {
    if (!desktop || pathBusy.value) return
    path.add(newPath.value)
    newPath.value = ''
  }

  watch(activeSection, (section) => {
    if (!desktop) return
    if (section === 'environment' && !pathBusy.value && !path.state.rawPath) void path.load()
    if (section === 'hosts' && !hostsBusy.value && !hosts.state.digest) void hosts.load()
  })
</script>

<style scoped>
  .settings-layout { grid-template-columns: 155px minmax(0, 1fr); }
  .settings-nav { align-self: start; }
  .settings-submit { margin-top: 12px; }
</style>
