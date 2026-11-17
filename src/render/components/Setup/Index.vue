<template>
  <div class="soft-index-panel main-right-panel app-workbench-page app-settings-page">
    <AppPageHeader :title="I18nT('base.settings')" />
    <div class="app-settings-workspace">
      <nav class="app-settings-nav" :aria-label="I18nT('base.settings')">
        <button
          v-for="item in tabs"
          :key="item.value"
          type="button"
          :aria-current="store.tab === item.value ? 'page' : undefined"
          @click="store.tab = item.value"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
          <el-icon class="app-settings-nav__arrow"><ArrowRight /></el-icon>
        </button>
      </nav>
      <div class="main-block app-settings-detail">
        <Common v-if="store.tab === 'base'"></Common>
        <ModuleVM v-else-if="store.tab === 'module'" />
        <UIConfig v-else-if="store.tab === 'editor'"></UIConfig>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { ArrowRight, Grid, Monitor, Setting } from '@element-plus/icons-vue'
  import Common from './Common.vue'
  import UIConfig from './UIConfig/index.vue'
  import { I18nT } from '@lang/index'
  import { SetupStore } from '@/components/Setup/store'
  import ModuleVM from './Module/index.vue'
  import AppPageHeader from '@/components/AppShell/AppPageHeader.vue'

  const store = SetupStore()

  const tabs = computed(() => {
    return [
      {
        value: 'base',
        icon: Setting,
        label: I18nT('base.setupBase')
      },
      {
        value: 'module',
        icon: Grid,
        label: I18nT('setup.moduleTitle')
      },
      {
        value: 'editor',
        icon: Monitor,
        label: 'UI'
      }
    ]
  })
</script>
