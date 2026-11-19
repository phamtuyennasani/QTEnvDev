<template>
  <details class="local-certificate-help">
    <summary>Trust the local certificate</summary>
    <p
      >Browsers trust automatically issued certificates after your system trusts the QTEnvDev root
      certificate.</p
    >
    <div class="detail-actions">
      <button
        type="button"
        class="action-button"
        :disabled="controller.state.busy"
        @click="controller.act('copy')"
        >{{ windows ? 'Copy PowerShell command' : 'Copy trust command' }}</button
      >
      <button
        type="button"
        class="action-button"
        :disabled="controller.state.busy"
        @click="controller.act('reveal')"
        >Show root certificate</button
      >
    </div>
  </details>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { localCertificateController as controller } from './localCertificateController'
  const windows = computed(() => window.Server?.isWindows)
</script>

<style scoped>
  .local-certificate-help {
    font-size: 12px;
  }
  .local-certificate-help p {
    margin: 8px 0;
    color: var(--pqt-text-muted);
  }
  .local-certificate-help .detail-actions {
    gap: 8px;
  }
</style>
