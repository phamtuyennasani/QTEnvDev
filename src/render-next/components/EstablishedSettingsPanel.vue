<template>
  <div class="pqt-established-tool pqt-settings-surface">
    <template v-if="section === 'general'">
      <div class="settings-options">
        <section class="settings-option"><LanguageSetting /></section>
        <section class="settings-option">
          <label for="forge-theme" class="plant-title">{{ I18nT('base.theme') }}</label>
          <select id="forge-theme" v-model="theme" class="theme-select">
            <option value="system">{{ I18nT('base.themeAuto') }}</option>
            <option value="dark">{{ I18nT('base.themeDark') }}</option>
            <option value="light">{{ I18nT('base.themeLight') }}</option>
          </select>
        </section>
        <section class="settings-option"><TrayStyle /></section>
        <section v-if="supportsAutoLaunch" class="settings-option"><AutoLaunch /></section>
        <section class="settings-option"><AutoHide /></section>
        <section class="settings-option">
          <AutoStartService />
          <p class="muted">Uses the default startup group, or starts enabled services when no group is selected.</p>
        </section>
        <section class="settings-option"><AutoUpdate /></section>
        <section v-if="isUnix" class="settings-option"><UnixHelperMaintenance /></section>
        <section class="settings-option settings-option-wide"><ProxySetting /></section>
        <section v-if="isWindows" class="settings-option settings-option-wide">
          <WindowsElevationMethod />
        </section>
      </div>
    </template>
    <template v-else-if="section === 'editors'">
      <div class="settings-options">
        <section class="settings-option settings-option-wide"><AppFont /></section>
        <section class="settings-option settings-option-wide"><CodeFont /></section>
        <section class="settings-option settings-option-wide"><EditorSettings /></section>
      </div>
    </template>
    <About v-else-if="section === 'about'" />
    <Licenses v-else-if="section === 'licenses'" />
  </div>
</template>

<script setup lang="ts">
  import { computed, defineAsyncComponent, watch } from 'vue'
  import LanguageSetting from '@/components/Setup/LangSet/index.vue'
  import AutoLaunch from '@/components/Setup/AutoLanch/index.vue'
  import AutoHide from '@/components/Setup/AutoHide/index.vue'
  import AutoStartService from '@/components/Setup/AutoStartService/index.vue'
  import { AppStore } from '@/store/app'
  import { I18nT } from '@lang/index'
  import AutoUpdate from '@/components/Setup/AutoUpdate/index.vue'
  import TrayStyle from '@/components/Setup/TrayStyle/index.vue'
  import ProxySetting from '@/components/Setup/ProxySet/index.vue'
  import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'

  const props = defineProps<{ section: 'general' | 'editors' | 'about' | 'licenses' }>()
  const isWindows = computed(() => window.Server?.isWindows)
  const isUnix = computed(() => window.Server?.isMacOS || window.Server?.isLinux)
  const supportsAutoLaunch = computed(() => isWindows.value || isUnix.value)
  const store = AppStore()
  const theme = computed({
    get: () => store.config.setup.theme || 'system',
    set: (value: string) => {
      store.config.setup.theme = value
      void store.saveConfig()
    }
  })
  const WindowsElevationMethod = defineAsyncComponent(
    () => import('@/components/Setup/WindowsElevationMethod/index.vue')
  )
  const UnixHelperMaintenance = defineAsyncComponent(
    () => import('@/components/Setup/QTEnvDevHelper/index.vue')
  )
  const EditorSettings = defineAsyncComponent(() => import('@/components/Setup/EditorConfig/index.vue'))
  const CodeFont = defineAsyncComponent(() => import('@/components/Setup/CodeFont/index.vue'))
  const AppFont = defineAsyncComponent(() => import('@/components/Setup/AppFont/index.vue'))
  const About = defineAsyncComponent(() => import('@/components/About/index.vue'))
  const Licenses = defineAsyncComponent(() => import('@/components/Setup/Licenses/index.vue'))

  provideLegacyToolContext({ poperFix: true, detachedClass: 'pqt-settings-surface' })

  watch(() => props.section, (section) => {
    if (section === 'editors') void import('@/util/Font').then(({ default: font }) => font.init()).catch(() => {})
  }, { immediate: true })
</script>

<style scoped>
  .pqt-settings-surface {
    min-height: 0;
    height: auto;
    overflow: visible;
  }
  .settings-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .settings-option {
    min-width: 0;
    padding: 14px;
    border: 1px solid var(--pqt-border);
    border-radius: 8px;
    background: var(--pqt-canvas);
  }
  .settings-option-wide { grid-column: 1 / -1; }
  .settings-option :deep(.plant-title) {
    min-height: 24px;
    margin-bottom: 8px;
    font-weight: 600;
  }
  .settings-option :deep(.brew-src .el-select) { width: 100%; }
  .settings-option :deep(.proxy-set .el-form-item:last-child) { margin-bottom: 0; }
  .settings-option :deep(.method-status) { margin-top: 8px; }
  .theme-select {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--pqt-border-strong);
    border-radius: 6px;
    background: var(--pqt-field);
    color: var(--pqt-text);
    font: inherit;
  }
  @media (max-width: 760px) {
    .settings-options { grid-template-columns: minmax(0, 1fr); }
  }
</style>
