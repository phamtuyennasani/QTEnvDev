<template>
  <div class="pqt-established-tool pqt-database-manage-surface">
    <component :is="props.component" ref="drawer" :item="props.item" :open-admin="openAdmin" />
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref, type Component } from 'vue'
  import type { ModuleInstalledItem } from '@/core/Module/ModuleInstalledItem'
  import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'
  import { databaseAdminController } from '../state/databaseAdminController'
  const props = defineProps<{ item: ModuleInstalledItem; component: Component }>()
  const emit = defineEmits<{ close: [] }>()
  const drawer = ref<{ onClosed(fn: () => void): void }>()
  provideLegacyToolContext({ poperFix: true, detachedClass: 'pqt-database-manage-surface' })
  onMounted(() => drawer.value?.onClosed(() => emit('close')))
  const openAdmin = () => databaseAdminController.open('phpmyadmin', props.item.typeFlag === 'mysql' ? 'mysql' : 'mariadb', props.item)
</script>

<style>
  .pqt-database-manage-surface {
    height: 0;
    overflow: visible;
  }
  .pqt-database-manage-surface .host-vhost {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .pqt-database-manage-surface .host-vhost .main-wapper {
    min-height: 0;
    overflow: auto;
    padding-top: 12px;
  }
  .pqt-database-manage-surface .host-vhost .nav > .left,
  .pqt-database-manage-surface .host-vhost .card-header > .left {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .pqt-database-manage-surface .host-vhost .nav > .left {
    cursor: pointer;
  }
  .pqt-database-manage-surface .top-back-icon {
    width: 22px;
    height: 22px;
  }
</style>
