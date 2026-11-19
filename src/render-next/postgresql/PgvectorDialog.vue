<template>
  <ForgeDialog
    title="PostgreSQL extensions"
    :description="versionLabel"
    wide
    @close="emit('close')"
  >
    <div class="detail-actions">
      <strong>pgvector</strong>
      <span v-if="controller.phase === 'checking'" role="status">Checking files…</span>
      <span v-else-if="controller.phase === 'installing'" role="status">Installing…</span>
      <span v-else-if="controller.status">{{
        controller.status.installed ? 'Installed' : 'Not installed'
      }}</span>
      <button class="action-button" :disabled="controller.busy" @click="refresh">Refresh</button>
      <button v-if="controller.canInstall" class="primary-button" @click="controller.install()">{{
        controller.status?.requiresAdministrator ? 'Install pgvector with sudo' : 'Install pgvector'
      }}</button>
    </div>
    <p v-if="!controller.supported()" class="website-help"
      >Source installation is available on macOS and Linux.</p
    >
    <p v-else-if="controller.canInstall" class="website-help"
      >Requires Git, make, a C compiler, and PostgreSQL development headers.</p
    >
    <p
      v-else-if="controller.status && !controller.status.installed && olderVersion"
      class="website-help"
      >This pgvector release requires PostgreSQL 13 or newer.</p
    >
    <p
      v-if="controller.message"
      class="forge-alert"
      :role="controller.phase === 'installed' ? 'status' : 'alert'"
      >{{ controller.message }}</p
    >
    <p v-if="controller.status?.installed && !controller.busy" class="website-help">
      To enable pgvector, run <code>CREATE EXTENSION vector;</code> in each database that needs it.
    </p>
    <div v-if="controller.terminal" ref="terminalView" class="pgvector-terminal"></div>
  </ForgeDialog>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import ForgeDialog from '../components/ForgeDialog.vue'
  import { pgvectorController as controller } from './PgvectorController'

  const props = defineProps<{ target: { version: string; bin: string } }>()
  const emit = defineEmits<{ close: [] }>()
  const terminalView = ref<HTMLElement>()
  const versionLabel = computed(() => controller.target?.version ?? props.target.version)
  const olderVersion = computed(() => Number(versionLabel.value.split('.')[0]) < 13)
  const refresh = () =>
    controller.check(
      controller.phase === 'unknown' && controller.target ? controller.target : props.target
    )
  onMounted(() => {
    void refresh()
  })
  watch(
    [terminalView, () => controller.terminal],
    ([view], [previous]) => {
      if (previous && previous !== view) controller.detach(previous)
      if (view) void controller.attach(view)
    },
    { flush: 'post' }
  )
  onBeforeUnmount(() => {
    if (terminalView.value) controller.detach(terminalView.value)
  })
</script>

<style scoped>
  .pgvector-terminal {
    height: 280px;
    overflow: hidden;
  }
</style>
