<template>
  <ForgeDialog :title="title" wide @close="$emit('close')">
    <div class="pqt-established-tool runtime-workflow">
      <component :is="surface" />
    </div>
  </ForgeDialog>
</template>

<script setup lang="ts">
  import { computed, defineAsyncComponent } from 'vue'
  import ForgeDialog from './ForgeDialog.vue'
  import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'

  const props = defineProps<{ workflow: 'node' | 'npm' | 'gvm' }>()
  defineEmits<{ close: [] }>()
  provideLegacyToolContext({ poperFix: true, detachedClass: 'pqt-runtime-workflow' })

  const titles = {
    node: 'Node.js version managers',
    npm: 'npm configuration',
    gvm: 'Go Version Manager'
  }
  const surfaces = {
    node: defineAsyncComponent(() => import('@/components/Nodejs/List.vue')),
    npm: defineAsyncComponent(() => import('@/components/Nodejs/Config.vue')),
    gvm: defineAsyncComponent(() => import('@/components/GoLang/gvm/index.vue'))
  }
  const title = computed(() => titles[props.workflow])
  const surface = computed(() => surfaces[props.workflow])
</script>

<style scoped>
  .runtime-workflow :deep(.el-card) {
    height: 100%;
  }
  .runtime-workflow :deep(.version-manager) {
    display: flex;
    flex-direction: column;
  }
  .runtime-workflow :deep(.version-manager > .el-card__body) {
    flex: 1;
    min-height: 0;
  }
  .runtime-workflow :deep(.card-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
</style>
