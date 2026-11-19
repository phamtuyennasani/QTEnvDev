<template>
  <ForgeDialog title="Git environment" wide @close="$emit('close')">
    <p role="status" :aria-busy="controller.loading">{{ detectionStatus }}</p>
    <p v-if="controller.discoveryError" role="alert" class="forge-alert forge-alert--error">
      Git could not be checked. {{ controller.discoveryError }}
    </p>
    <button
      class="action-button"
      :disabled="controller.loading || controller.busy"
      @click="controller.refresh()"
    >
      Check for Git
    </button>

    <table v-if="controller.items.length" class="git-checks">
      <thead
        ><tr><th scope="col">Check</th><th scope="col">Result</th></tr></thead
      >
      <tbody>
        <tr v-for="item in controller.items" :key="item.label">
          <th scope="row">{{ item.label }}</th>
          <td
            ><b>{{ item.ok ? 'Available' : 'Unavailable' }}</b
            ><code>{{ item.value }}</code
            ><span>{{ item.message }}</span></td
          >
        </tr>
      </tbody>
    </table>

    <div v-if="controller.canInstall && controller.methods.length" class="git-actions">
      <label>
        Install Git with
        <select v-model="selection">
          <option value="">Choose an installer</option>
          <option v-for="method in controller.methods" :key="method.id" :value="method.id">{{
            method.label
          }}</option>
        </select>
      </label>
      <button class="action-button action-button--primary" :disabled="!selection" @click="install">
        Install Git
      </button>
    </div>

    <div v-if="controller.phase !== 'idle'" class="git-result">
      <p role="status">{{ installStatus }}</p>
      <p v-if="controller.error" class="forge-alert forge-alert--error" role="alert">{{
        controller.error
      }}</p>
      <p v-if="controller.terminalError" class="forge-alert forge-alert--error" role="alert">{{
        controller.terminalError
      }}</p>
      <div
        v-if="controller.showTerminal"
        ref="terminalElement"
        class="git-terminal"
        aria-label="Git installer terminal"
      />
      <button v-if="controller.canCancel" class="action-button" @click="controller.cancel()">
        Cancel installation
      </button>
    </div>
  </ForgeDialog>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import {
    gitEnvironment as controller,
    type GitInstaller
  } from '../state/gitEnvironmentController'
  import ForgeDialog from './ForgeDialog.vue'

  defineEmits<{ close: [] }>()
  const selection = ref<GitInstaller | ''>('')
  const terminalElement = ref<HTMLElement>()
  const install = () => {
    if (selection.value) void controller.start(selection.value)
  }
  const detectionStatus = computed(() => {
    if (controller.loading) return 'Checking for Git…'
    if (controller.installed) return controller.version || 'Git is available.'
    if (controller.discoveryError) return 'Git availability is unconfirmed.'
    return controller.installed === false ? 'Git was not detected.' : 'Git has not been checked.'
  })
  const installStatus = computed(
    () =>
      ({
        idle: '',
        starting: 'Opening the installer…',
        running: 'Follow the terminal or installer prompts to continue.',
        stopping: 'Stopping the installer…',
        succeeded: 'The package manager reported success.',
        requested: 'The Apple installer was requested. Check for Git after it finishes.',
        failed: 'The Git installation failed.',
        cancelled: 'The Git installation was cancelled.',
        unknown:
          'The installation result is unknown. Check for Git and review the installer before closing the application.'
      })[controller.phase]
  )
  watch(
    [terminalElement, () => controller.phase === 'starting'],
    ([element], [previous]) => {
      if (previous && previous !== element) controller.detach(previous)
      if (element) void controller.attach(element)
    },
    { flush: 'post' }
  )
  onMounted(() => {
    void controller.refresh()
  })
  onBeforeUnmount(() => {
    if (terminalElement.value) controller.detach(terminalElement.value)
  })
</script>

<style scoped>
  .git-actions {
    display: flex;
    align-items: end;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 16px;
  }
  .git-actions label {
    display: grid;
    gap: 6px;
  }
  .git-actions select {
    padding: 6px 10px;
    color: inherit;
    background: var(--pqt-surface);
    border: 1px solid var(--pqt-border);
    border-radius: 6px;
  }
  .git-result,
  .git-checks {
    margin-top: 16px;
  }
  .git-checks {
    border-collapse: collapse;
    width: 100%;
  }
  .git-checks :is(th, td) {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid var(--pqt-border);
    vertical-align: top;
  }
  .git-checks :is(code, span) {
    display: block;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .git-terminal {
    height: 230px;
    margin: 8px 0;
    padding: 8px;
    overflow: hidden;
    background: #282b3d;
    border-radius: 5px;
  }
</style>
