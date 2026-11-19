<template>
  <div class="plant-title flex items-center gap-1">
    <span>{{ $t('setup.autoLaunch') }}</span>
    <el-popover placement="top" width="auto">
      <template #reference>
        <yb-icon :svg="import('@/svg/question.svg?raw')" width="12" height="12"></yb-icon>
      </template>
      <template #default>
        <span>{{ $t('setup.autoLaunchTips') }}</span>
      </template>
    </el-popover>
  </div>
  <div class="main reset-pass">
    <el-switch
      :aria-label="$t('setup.autoLaunch')"
      :disabled="autoLaunch.busy"
      :model-value="enabled"
      @change="autoLaunch.setEnabled($event === true)"
    />
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { AppStore } from '@/store/app'
  import { autoLaunch } from './Controller'

  const store = AppStore()
  const enabled = computed(() => store.config.setup.autoLaunch === true)
  void autoLaunch.syncMac()
</script>
