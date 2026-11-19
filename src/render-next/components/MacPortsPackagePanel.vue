<template>
  <div class="port-panel" :aria-busy="catalog.loading">
    <template v-if="!controller.available">
      <p>MacPorts is not available. Install MacPorts before browsing its ports.</p>
      <button class="action-button" @click="controller.openGuide()"
        >MacPorts installation guide</button
      >
    </template>
    <template v-else>
      <div v-if="controller.operation?.flag === props.flag" class="port-status" role="status">
        <b>{{ status[controller.operation.status] }}</b>
        <p>{{ controller.operation.name }}</p>
        <p v-if="controller.operation.error" role="alert">{{ controller.operation.error }}</p>
        <p v-if="controller.terminalError" role="alert">{{ controller.terminalError }}</p>
        <p v-if="controller.operation.status === 'running'"
          >Follow the prompts in the terminal to continue.</p
        >
        <div
          v-if="controller.showTerminal"
          ref="terminalElement"
          class="port-terminal"
          aria-label="MacPorts terminal"
        />
        <button v-if="controller.canStop" class="action-button" @click="controller.cancel()"
          >Stop MacPorts</button
        >
      </div>
      <p v-if="catalog.error" class="forge-alert forge-alert--error" role="alert">{{
        catalog.error
      }}</p>
      <p v-if="catalog.warning" class="forge-alert" role="status">{{ catalog.warning }}</p>
      <p v-if="catalog.loading && !rows.length" class="empty-copy">Retrieving MacPorts ports…</p>
      <p v-else-if="!rows.length && !catalog.error" class="empty-copy">{{
        query ? 'No ports match your search.' : 'No MacPorts ports were returned.'
      }}</p>
      <div v-if="removal" class="port-status" role="group" aria-label="Confirm MacPorts uninstall">
        <b>Uninstall {{ removal.name }} with MacPorts?</b>
        <div class="detail-actions">
          <button class="action-button" @click="removal = undefined">Cancel</button>
          <button
            class="action-button action-button--primary"
            :disabled="blocked"
            @click="confirmRemoval"
            >Confirm uninstall</button
          >
        </div>
      </div>
      <div v-for="row in rows" :key="row.name" class="port-row">
        <div
          ><b>{{ row.name }}</b
          ><small>{{ row.version }}</small></div
        >
        <div class="port-actions">
          <span v-if="row.installed" class="package-tag">Installed</span>
          <button class="action-button" @click="controller.copyCommand(props.flag, row)"
            >Copy command</button
          >
          <button
            class="action-button"
            :disabled="blocked"
            @click="row.installed ? (removal = row) : controller.change(props.flag, row)"
            >{{ row.installed ? 'Uninstall' : 'Install' }}</button
          >
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import {
    macportsPackages as controller,
    type MacPortsRow
  } from '../state/macportsPackagesController'

  const props = defineProps<{ flag: string; query: string; otherSourceBusy: boolean }>()
  const terminalElement = ref<HTMLElement>()
  const removal = ref<MacPortsRow>()
  const catalog = computed(() => controller.catalog(props.flag))
  const blocked = computed(
    () =>
      props.otherSourceBusy ||
      controller.busy ||
      catalog.value.loading ||
      Boolean(catalog.value.error)
  )
  const status = {
    starting: 'Opening the MacPorts terminal…',
    running: 'MacPorts is working…',
    stopping: 'Stopping MacPorts…',
    success: 'MacPorts operation completed.',
    failed: 'MacPorts operation failed.',
    cancelled: 'MacPorts operation stopped. Check the catalog for changes that may have completed.',
    unknown: 'MacPorts result unknown. Stop the terminal before retrying.'
  }
  const rows = computed(() =>
    catalog.value.rows.filter((row) =>
      `${row.name} ${row.version}`.toLowerCase().includes(props.query.trim().toLowerCase())
    )
  )
  const confirmRemoval = () => {
    if (blocked.value || !removal.value) return
    void controller.change(props.flag, removal.value)
    removal.value = undefined
  }
  watch(
    terminalElement,
    (element, previous) => {
      if (previous && previous !== element) controller.detach(previous)
      if (element) void controller.attach(element)
    },
    { flush: 'post' }
  )
  onBeforeUnmount(() => {
    if (terminalElement.value) controller.detach(terminalElement.value)
  })
</script>

<style scoped>
  .port-panel {
    padding-top: 12px;
  }
  .port-status {
    margin-bottom: 12px;
    padding: 12px;
    border: 1px solid var(--pqt-border);
    border-radius: 7px;
  }
  .port-status p {
    margin: 8px 0;
    overflow-wrap: anywhere;
  }
  .port-terminal {
    height: 240px;
    margin: 8px 0;
    padding: 8px;
    overflow: hidden;
    background: #282b3d;
    border-radius: 5px;
  }
  .port-row,
  .port-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .port-row {
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid var(--pqt-border);
  }
  .port-row small {
    display: block;
    margin-top: 3px;
    color: var(--pqt-text-muted);
  }
</style>
