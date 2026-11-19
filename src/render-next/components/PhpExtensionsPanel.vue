<template>
  <div class="pqt-established-tool pqt-php-extension-surface">
    <EstablishedExtensions ref="drawer" :version="snapshot" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import EstablishedExtensions from '@/components/PHP/Extends.vue'
import type { SoftInstalled } from '@shared/app'
import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'

const props = defineProps<{ version: SoftInstalled }>()
const emit = defineEmits<{ close: [] }>()
provideLegacyToolContext({ poperFix: true, detachedClass: 'pqt-php-extension-surface' })

// The drawer stays on the PHP binary selected when it opened.
const snapshot = JSON.parse(JSON.stringify(props.version)) as SoftInstalled
const drawer = ref<InstanceType<typeof EstablishedExtensions>>()
onMounted(() => { drawer.value?.onClosed(() => emit('close')) })
</script>

<style>
.pqt-php-extension-surface {
  height: 0;
  min-height: 0;
  overflow: visible;
}
.pqt-php-extension-surface .el-drawer__body { height: 100%; min-height: 0; overflow: hidden; }
.pqt-php-extension-surface .php-extensions { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.pqt-php-extension-surface .php-extensions > .nav { display: flex; align-items: center; justify-content: space-between; flex: none; padding: 0 0 12px; }
.pqt-php-extension-surface .nav > .left { display: flex; align-items: center; gap: 6px; }
.pqt-php-extension-surface .top-back-icon { width: 24px; height: 24px; }
.pqt-php-extension-surface .main-wapper { display: flex; flex: 1; min-height: 0; }
.pqt-php-extension-surface .main-wapper > .el-card { display: flex; flex: 1; flex-direction: column; min-height: 0; }
.pqt-php-extension-surface .el-card__body { flex: 1; min-height: 0; overflow: auto; }
.pqt-php-extension-surface .card-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
</style>
