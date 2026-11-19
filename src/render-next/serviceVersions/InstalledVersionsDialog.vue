<template>
  <ForgeDialog :title="'Installed versions · ' + title" wide @close="$emit('close')">
    <div class="pqt-established-tool installed-versions-surface dark">
      <RuntimeManager
        v-if="runtime || (flag === 'php' && title === 'PHP')"
        :title="title"
        :type-flag="flag"
        :fetch-data-when-create="runtime"
      >
        <template #operation="{ row }">
          <PhpVersionActions v-if="flag === 'php'" :item="row" />
        </template>
      </RuntimeManager>
      <ServiceManager v-else :type-flag="flag" :title="title">
        <template #action="{ row }">
          <PhpVersionActions v-if="flag === 'php'" :item="row" />
          <FrankenPhpVersionActions v-else-if="flag === 'frankenphp'" :item="row" />
        </template>
      </ServiceManager>
    </div>
  </ForgeDialog>
</template>

<script setup lang="ts">
  import { defineAsyncComponent, h } from 'vue'
  import type { AllAppModule } from '@/core/type'
  import { registerLifecycle } from '../adapters/lifecycleAdapter'
  import ForgeDialog from '../components/ForgeDialog.vue'
  import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'

  const props = defineProps<{ flag: AllAppModule; title: string; runtime?: boolean }>()
  defineEmits<{ close: [] }>()

  provideLegacyToolContext({ poperFix: true, detachedClass: 'pqt-installed-versions' })

  const ServiceManager = defineAsyncComponent({
    async loader() {
      await registerLifecycle(props.flag)
      return import('@/components/ServiceManager/index.vue')
    },
    errorComponent: {
      render: () =>
        h('p', { role: 'alert' }, 'Could not open the installed versions. Close and try again.')
    }
  })
  const RuntimeManager = defineAsyncComponent({
    loader: () => import('@/components/ServiceManager/base.vue'),
    errorComponent: {
      render: () =>
        h('p', { role: 'alert' }, 'Could not open the installed versions. Close and try again.')
    }
  })
  const PhpVersionActions = defineAsyncComponent(
    () => import('@/components/PHP/VersionActions.vue')
  )
  const FrankenPhpVersionActions = defineAsyncComponent(
    () => import('@/components/FrankenPHP/VersionActions.vue')
  )
</script>

<style scoped>
  :global(.forge-dialog--wide:has(.installed-versions-surface)) {
    width: 1080px;
  }

  .installed-versions-surface :deep(.card-header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .installed-versions-surface :deep(.card-header .left) {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .installed-versions-surface :deep(.el-table__row .truncate.current) {
    color: var(--pqt-accent);
    font-weight: 600;
  }

  .installed-versions-surface :deep(.el-table__row .truncate.current::after) {
    content: 'Current';
    margin-inline-start: 6px;
    font-size: 10px;
  }
</style>
