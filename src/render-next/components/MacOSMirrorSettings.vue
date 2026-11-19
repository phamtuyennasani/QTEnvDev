<template>
  <div v-if="macOS" class="macos-mirror-settings">
    <section aria-labelledby="homebrew-mirror-heading">
      <h2 id="homebrew-mirror-heading">Homebrew mirror</h2>
      <p v-if="!controller.installed" class="muted">Install Homebrew to switch mirrors.</p>
      <template v-else>
        <p class="muted"
          >Switching the mirror updates Homebrew Git remotes and shell profile settings.</p
        >
        <p>Current Git origin: {{ currentLabel }}</p>
        <div class="mirror-controls">
          <label
            >New mirror
            <select v-model="selection" :disabled="disabled">
              <option value="">Choose a mirror</option>
              <option v-for="(label, key) in homebrewMirrors" :key="key" :value="key">{{
                I18nT(label)
              }}</option>
            </select>
          </label>
          <button
            class="action-button action-button--primary"
            :disabled="disabled || !selection"
            @click="apply"
            >Apply mirror</button
          >
          <button
            class="action-button"
            :disabled="controller.loading || controller.applying || controller.unknown"
            @click="controller.refresh()"
            >Refresh</button
          >
        </div>
        <p v-if="controller.progress || controller.loading" class="muted" role="status">{{
          controller.progress || 'Loading mirror…'
        }}</p>
        <p v-if="controller.error" class="forge-alert forge-alert--error" role="alert">{{
          controller.error
        }}</p>
      </template>
    </section>
    <section aria-label="MacPorts mirror">
      <div v-if="macPorts" class="pqt-established-tool"><MacPortsSource /></div>
      <template v-else>
        <h2>MacPorts mirror</h2>
        <p class="muted">Install MacPorts to switch mirrors.</p>
      </template>
    </section>
  </div>
  <p v-else class="muted">These mirror settings are available on macOS.</p>
</template>

<script setup lang="ts">
  import { computed, defineAsyncComponent, ref, watch } from 'vue'
  import { homebrewMirrors, isHomebrewMirror, type HomebrewMirror } from '@shared/homebrewMirrors'
  import { I18nT } from '@lang/index'
  import { homebrewMirrorController as controller } from '../state/homebrewMirrorController'
  import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'

  provideLegacyToolContext()
  const MacPortsSource = defineAsyncComponent(
    () => import('@/components/Setup/MacPortsSrc/index.vue')
  )
  const macOS = computed(() => Boolean(window.Server?.isMacOS))
  const macPorts = computed(() => Boolean(window.Server?.MacPorts))
  const selection = ref<HomebrewMirror | ''>('')
  const disabled = computed(
    () => controller.loading || controller.applying || controller.unknown || !controller.current
  )
  const currentLabel = computed(() => {
    const current = controller.current
    if (current === 'custom') return 'Custom origin'
    return isHomebrewMirror(current) ? I18nT(homebrewMirrors[current]) : 'Unconfirmed'
  })
  const apply = () => {
    if (selection.value) void controller.apply(selection.value)
  }
  watch(
    () => controller.installed,
    (installed) => {
      if (installed) void controller.refresh()
    },
    { immediate: true }
  )
</script>

<style scoped>
  .macos-mirror-settings {
    display: grid;
    gap: 24px;
  }
  .mirror-controls,
  .mirror-controls label {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }
  .mirror-controls select {
    background: var(--pqt-surface);
    color: inherit;
    border: 1px solid var(--pqt-border);
    border-radius: 6px;
    padding: 7px 10px;
  }
</style>
