<template>
  <ForgeDialog
    title="Vhost templates"
    description="Edit the templates used when QTEnvDev generates Nginx, Apache, Caddy and FrankenPHP host files."
    eyebrow="WEBSITES / TEMPLATES"
    wide
    @close="emit('close')"
  >
    <div class="template-panel" :aria-busy="busy">
      <div class="template-toolbar">
        <label>
          Template
          <select v-model="selected" :disabled="controller.busy">
            <option v-for="item in vhostTemplateOptions" :key="item.key" :value="item.key">
              {{ item.label }}
            </option>
          </select>
        </label>
        <button v-if="error" class="action-button" :disabled="busy" @click="load">
          Reload template
        </button>
        <div class="detail-actions">
          <button class="action-button" :disabled="!loaded || busy" @click="loadDefault">
            Load bundled default
          </button>
          <button class="action-button" :disabled="!loaded || busy" @click="importDraft">
            Import file
          </button>
          <button class="action-button" :disabled="!loaded || busy" @click="exportDraft">
            Export draft
          </button>
          <button class="action-button" :disabled="!loaded || busy" @click="reveal">
            Reveal file ↗
          </button>
        </div>
      </div>
      <textarea
        v-model="content"
        aria-label="Template content"
        :disabled="!loaded || busy"
        spellcheck="false"
      />
      <p v-if="error" class="forge-alert forge-alert--error" role="alert">{{ error }}</p>
    </div>
    <template #footer>
      <span class="website-help">
        Changes apply to newly generated hosts and the next save of an existing host.
      </span>
      <button class="action-button" @click="emit('close')">Close</button>
      <button class="primary-button" :disabled="!loaded || busy" @click="save">
        {{ controller.saving ? 'Saving…' : 'Save template' }}
      </button>
    </template>
  </ForgeDialog>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
  import { websiteError } from '../websites/types'
  import {
    vhostTemplateController as controller,
    vhostTemplateOptions,
    type VhostTemplateKey,
    type VhostTemplateSnapshot
  } from '../state/vhostTemplateController'
  import ForgeDialog from './ForgeDialog.vue'

  const emit = defineEmits<{ close: [] }>()
  const selected = ref<VhostTemplateKey>('nginx')
  const loaded = shallowRef<VhostTemplateSnapshot>()
  const content = ref('')
  const loading = ref(false)
  const error = ref('')
  const busy = computed(() => loading.value || controller.busy)
  let revision = 0

  async function load() {
    const request = ++revision
    const key = selected.value
    loaded.value = undefined
    content.value = ''
    error.value = ''
    loading.value = true
    try {
      const snapshot = await controller.load(key)
      if (request !== revision) return
      loaded.value = snapshot
      content.value = snapshot.content
    } catch (failure) {
      if (request === revision) error.value = websiteError(failure)
    } finally {
      if (request === revision) loading.value = false
    }
  }

  async function save() {
    if (!loaded.value || busy.value) return
    const request = revision
    const failure = await controller.save(loaded.value, content.value)
    if (request !== revision) return
    if (failure) error.value = failure
    else emit('close')
  }

  async function replaceDraft(read: () => Promise<string | undefined>) {
    if (!loaded.value || busy.value) return
    const request = ++revision
    loading.value = true
    error.value = ''
    try {
      const draft = await read()
      if (request === revision && draft !== undefined) content.value = draft
    } catch (failure) {
      if (request === revision) error.value = websiteError(failure)
    } finally {
      if (request === revision) loading.value = false
    }
  }

  const loadDefault = () => replaceDraft(() => controller.loadDefault(selected.value))
  const importDraft = () => replaceDraft(() => controller.importDraft())
  const exportDraft = () => {
    if (loaded.value && !busy.value) void controller.exportDraft(selected.value, content.value)
  }

  function reveal() {
    if (loaded.value) void controller.reveal(loaded.value.source)
  }

  watch(selected, load, { immediate: true, flush: 'sync' })
  onBeforeUnmount(() => {
    revision += 1
  })
</script>
