<template>
  <div class="soft-index-panel main-right-panel app-workbench-page">
    <AppPageHeader :title="I18nT('base.settings')" />
    <el-radio-group
      v-model="store.tab"
      class="app-settings-tabs"
      :aria-label="I18nT('base.settings')"
    >
      <el-radio-button v-for="item in tabs" :key="item.value" :value="item.value">
        {{ item.label }}
      </el-radio-button>
    </el-radio-group>
    <div class="main-block">
      <Common v-if="store.tab === 'base'"></Common>
      <ModuleVM v-else-if="store.tab === 'module'" />
      <Plugins v-else-if="store.tab === 'plugins'" />
      <UIConfig v-else-if="store.tab === 'editor'"></UIConfig>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import Common from './Common.vue'
  import UIConfig from './UIConfig/index.vue'
  import { I18nT } from '@lang/index'
  import { SetupStore } from '@/components/Setup/store'
  import ModuleVM from './Module/index.vue'
  import Plugins from './Plugins/index.vue'
  import AppPageHeader from '@/components/AppShell/AppPageHeader.vue'

  const store = SetupStore()

  const tabs = computed(() => {
    return [
      {
        value: 'base',
        label: I18nT('base.setupBase')
      },
      {
        value: 'module',
        label: I18nT('setup.moduleTitle')
      },
      {
        value: 'editor',
        label: 'UI'
      },
      {
        value: 'plugins',
        label: I18nT('setup.pluginsTitle')
      }
    ]
  })
</script>
