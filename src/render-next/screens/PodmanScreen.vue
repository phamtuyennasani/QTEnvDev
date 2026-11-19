<template>
  <section class="screen">
    <header class="page-header">
      <div>
        <h1>Podman</h1>
        <p class="subtitle">Manage machines, container images and Compose projects.</p>
      </div>
      <div class="detail-actions">
        <button class="action-button" @click="navigateNext('services')">Back to services</button>
        <button
          class="action-button"
          :disabled="manager.loading || installing"
          @click="manager.reinit()"
          >Refresh</button
        >
      </div>
    </header>
    <p v-if="manager.discoveryError" class="forge-alert forge-alert--error" role="alert">{{
      manager.discoveryError
    }}</p>
    <div v-if="showInstallResult" class="panel podman-install">
      <p role="status">{{ installMessage }}</p>
      <pre v-if="installLogs">{{ installLogs }}</pre>
    </div>
    <p v-if="manager.loading" class="empty-copy">Detecting Podman…</p>
    <div v-else-if="manager.inited && !manager.version" class="panel podman-install">
      <h2>Install Podman</h2>
      <p>Install Podman and refresh to detect the local command.</p>
      <div class="detail-actions">
        <button
          v-if="canInstall"
          class="primary-button"
          :disabled="brew.busy || installUnknown"
          @click="install"
          >Install with Homebrew</button
        >
        <button class="action-button" @click="openGuide">Installation guide ↗</button>
      </div>
    </div>
    <div v-else-if="manager.version" class="podman-workspace pqt-established-tool">
      <MachineList />
      <MachineDetails />
    </div>
  </section>
</template>

<script setup lang="ts">
  import { computed, onMounted } from 'vue'
  import MachineList from '@/components/Podman/left.vue'
  import MachineDetails from '@/components/Podman/right.vue'
  import { PodmanManager as manager } from '@/components/Podman/class/Podman'
  import { homebrewUpgrade as brew } from '@/components/VersionManager/brew/Controller'
  import { installPodman, openPodmanGuide, podmanInstallation } from '../podman/installation'
  import { navigateNext } from '../state/app'
  import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'

  provideLegacyToolContext({ poperFix: true })
  const canInstall = computed(() => Boolean(window.Server.isMacOS && window.Server.BrewBin))
  const installUnknown = computed(() => podmanInstallation.outcome === 'unknown')
  const installing = computed(() => podmanInstallation.running)
  const showInstallResult = computed(() => installing.value || !!podmanInstallation.message)
  const installMessage = computed(() =>
    installing.value ? 'Installing Podman…' : podmanInstallation.message
  )
  const installLogs = computed(() => (installing.value ? brew.logs : podmanInstallation.logs))
  const install = () => void installPodman()
  const openGuide = () => void openPodmanGuide()
  onMounted(() => {
    if (window.QTEnvDevNodeAPI) manager.init()
  })
</script>

<style scoped>
  .podman-install {
    padding: 16px;
    margin-bottom: 12px;
  }
  .podman-install p {
    margin: 8px 0;
  }
  .podman-install pre {
    max-height: 160px;
    overflow: auto;
    white-space: pre-wrap;
  }
  .podman-workspace {
    display: flex;
    gap: 12px;
  }
  .podman-workspace :deep(.app-container-aside) {
    flex: 0 0 min(240px, 30%);
  }
  .podman-workspace :deep(.app-container-detail) {
    min-width: 0;
    flex: 1;
  }
  .podman-workspace :deep(.el-card__body) {
    overflow: auto;
    min-height: 0;
  }
</style>
