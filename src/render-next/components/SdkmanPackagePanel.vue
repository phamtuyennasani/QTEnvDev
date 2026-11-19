<template>
  <section class="sdkman-panel" :aria-busy="catalog.loading">
    <p v-if="!controller.available" class="forge-alert"
      >Install SDKMAN on this computer to manage {{ label }} here.</p
    >
    <template v-else>
      <div class="sdkman-head">
        <span>{{ label }} versions managed by SDKMAN</span>
        <button
          v-if="catalog.rows.some((row) => row.installed)"
          class="action-button"
          :disabled="disabled"
          @click="controller.upgrade(flag)"
          >Upgrade {{ label }}</button
        >
      </div>
      <p v-if="catalog.error" class="forge-alert forge-alert--error" role="alert">{{
        catalog.error
      }}</p>
      <p v-else-if="catalog.loading && !catalog.rows.length" class="empty-copy"
        >Retrieving SDKMAN versions…</p
      >
      <p v-else-if="!filtered.length" class="empty-copy">{{
        query ? 'No versions match your search.' : 'No SDKMAN versions found.'
      }}</p>
      <div v-for="row in filtered" :key="String(row.identifier)" class="sdkman-row">
        <div
          ><b>{{ row.version }}</b
          ><small>{{ row.channel || row.identifier }}</small></div
        >
        <span>{{ row.installed ? 'Installed' : 'Available' }}</span>
        <button
          v-if="row.installed"
          class="action-button"
          :disabled="disabled"
          @click="pending = String(row.identifier)"
          >Remove</button
        >
        <button
          v-else
          class="action-button action-button--primary"
          :disabled="disabled"
          @click="controller.change(flag, 'install', String(row.identifier))"
          >Install</button
        >
      </div>
    </template>
    <div v-if="pending" class="forge-alert" role="alert">
      <p>Remove {{ label }} {{ pending }} from SDKMAN?</p>
      <div class="sdkman-actions">
        <button class="action-button" @click="pending = ''">Cancel</button>
        <button
          class="action-button action-button--danger"
          :disabled="disabled"
          @click="confirmRemove"
          >Remove version</button
        >
      </div>
    </div>
    <div v-if="operation" class="forge-alert" role="status">
      <p>{{ operation.message }}</p>
      <progress v-if="operation.status === 'running'" aria-label="SDKMAN operation in progress" />
      <p v-if="operation.warning">{{ operation.warning }}</p>
      <p v-if="controller.terminalError">{{ controller.terminalError }}</p>
    </div>
    <div
      v-if="operation"
      ref="terminal"
      class="sdkman-terminal"
      aria-label="SDKMAN terminal output"
    ></div>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref, watchEffect } from 'vue'
  import { sdkmanPackages as controller } from '../state/sdkmanPackagesController'
  import type { SdkmanFlag } from '../packages/sdkmanSources'

  const props = defineProps<{ flag: SdkmanFlag; query: string; otherSourceBusy: boolean }>()
  const labels = { java: 'Java', maven: 'Maven', gradle: 'Gradle' }
  const label = computed(() => labels[props.flag])
  const pending = ref('')
  const terminal = ref<HTMLElement>()
  const catalog = computed(() => controller.catalog(props.flag))
  const operation = computed(() =>
    controller.operation?.flag === props.flag ? controller.operation : undefined
  )
  const disabled = computed(
    () => props.otherSourceBusy || controller.busy || !catalog.value.loaded || catalog.value.loading
  )
  const filtered = computed(() =>
    catalog.value.rows.filter((row) => {
      return [row.version, row.identifier, row.name, row.channel]
        .join(' ')
        .toLowerCase()
        .includes(props.query.trim().toLowerCase())
    })
  )

  const confirmRemove = () => {
    const identifier = pending.value
    pending.value = ''
    if (identifier && !disabled.value) void controller.change(props.flag, 'remove', identifier)
  }

  watchEffect(
    (cleanup) => {
      const element = terminal.value
      const current = operation.value
      if (!element || !current) return
      void controller.attach(props.flag, element)
      cleanup(() => controller.detach(element))
    },
    { flush: 'post' }
  )
</script>

<style scoped>
  .sdkman-panel {
    display: grid;
    gap: 10px;
    padding-top: 12px;
  }
  .sdkman-head,
  .sdkman-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .sdkman-head,
  .sdkman-row > span {
    color: var(--pqt-text-muted);
    font-size: 10px;
  }
  .sdkman-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-top: 1px solid var(--pqt-border);
  }
  .sdkman-row b,
  .sdkman-row small {
    display: block;
  }
  .sdkman-row small {
    margin-top: 3px;
    color: var(--pqt-text-muted);
    font: 9px var(--pqt-font-mono);
  }
  .sdkman-terminal {
    height: 180px;
    overflow: hidden;
    border: 1px solid var(--pqt-border);
    border-radius: 7px;
  }
</style>
