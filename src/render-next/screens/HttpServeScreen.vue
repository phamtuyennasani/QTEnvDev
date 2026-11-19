<template>
  <section class="screen">
    <header class="page-header">
      <div>
        <p class="eyebrow">WORKSPACE / SERVICES</p>
        <h1>HTTP Serve</h1>
        <p class="subtitle">Share a folder with devices on your local network.</p>
      </div>
      <div class="detail-actions">
        <button class="action-button" @click="navigateNext('services')">Back to services</button>
        <button
          class="action-button"
          :disabled="httpServe.busy || !httpServe.available"
          @click="httpServe.refresh()"
          >Refresh</button
        >
        <button class="primary-button" :disabled="disabled" @click="httpServe.choose()"
          >Add folder</button
        >
      </div>
    </header>
    <p v-if="!httpServe.available" class="forge-alert">HTTP Serve requires the desktop app.</p>
    <p v-if="httpServe.error" class="forge-alert forge-alert--error messages" role="alert">{{
      httpServe.error
    }}</p>
    <p v-if="httpServe.warning" class="forge-alert messages" role="status">{{
      httpServe.warning
    }}</p>
    <article
      class="panel share-list"
      :aria-busy="httpServe.busy"
      @dragover.prevent
      @drop.prevent="drop"
    >
      <p v-if="rows.length === 0" class="empty-copy">{{
        httpServe.busy ? 'Checking folders…' : 'Add or drop a folder here to serve it.'
      }}</p>
      <div v-for="row in rows" :key="row.path" class="share-row">
        <div class="share-heading">
          <button class="action-button folder" @click="httpServe.reveal(row.path)">{{
            row.path
          }}</button>
          <span class="state-label">{{
            !httpServe.verified ? 'Unknown' : row.server ? 'Running' : 'Stopped'
          }}</span>
          <button
            v-if="row.saved || row.server"
            class="action-button"
            :disabled="disabled"
            @click="httpServe.change(row.server ? 'stop' : 'start', row.path)"
            >{{ row.server ? 'Stop' : 'Start' }}</button
          >
          <button
            v-if="row.saved"
            class="action-button"
            :disabled="disabled"
            @click="pending = row.path"
            >Remove</button
          >
        </div>
        <div v-for="url in row.server?.host ?? []" :key="url" class="detail-actions">
          <code>{{ url }}</code>
          <button class="action-button" @click="httpServe.useLink('open', url)">Open</button>
          <button class="action-button" @click="httpServe.useLink('copy', url)">Copy</button>
          <button class="action-button" @click="qrLink = url">QR code</button>
        </div>
      </div>
    </article>
    <ForgeDialog
      v-if="pending"
      title="Remove shared folder?"
      :description="pending"
      @close="pending = ''"
    >
      <p>Stops the server and removes this entry. The files stay on disk.</p>
      <div class="detail-actions">
        <button class="action-button" @click="pending = ''">Cancel</button>
        <button class="action-button action-button--danger" :disabled="disabled" @click="remove"
          >Stop and remove</button
        >
      </div>
    </ForgeDialog>
    <QrCodePanel v-if="qrLink" :initial-value="qrLink" @close="qrLink = ''" />
  </section>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import ForgeDialog from '../components/ForgeDialog.vue'
  import QrCodePanel from '../components/QrCodePanel.vue'
  import { httpServe } from '../httpServe/Controller'
  import { navigateNext } from '../state/app'

  const pending = ref('')
  const qrLink = ref('')
  const disabled = computed(() => httpServe.busy || !httpServe.verified)
  const rows = computed(() => {
    const active = new Map(httpServe.active.map((server) => [server.path, server]))
    const saved = new Set(httpServe.folders)
    return Array.from(new Set([...saved, ...active.keys()]), (path) => ({
      path,
      saved: saved.has(path),
      server: active.get(path)
    }))
  })

  function remove() {
    void httpServe.change('remove', pending.value)
    pending.value = ''
  }

  function drop(event: DragEvent) {
    if (disabled.value) return
    const files = Array.from(event.dataTransfer?.items ?? [], (item) => item.getAsFile())
    const paths = files.flatMap((file) => (file ? [window.QTEnvDevNodeAPI.showFilePath(file)] : []))
    void httpServe.change('add', ...paths.filter(Boolean))
  }

  onMounted(() => {
    void httpServe.refresh()
  })
</script>

<style scoped>
  .share-list {
    padding: 4px 16px;
  }
  .share-row {
    display: grid;
    gap: 8px;
    padding: 12px 0;
  }
  .share-row + .share-row {
    border-top: 1px solid var(--pqt-border);
  }
  .share-heading {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .share-heading .folder {
    min-width: 0;
    overflow-wrap: anywhere;
    margin-right: auto;
    text-align: left;
  }
  .messages {
    white-space: pre-wrap;
  }
</style>
