<template>
  <div class="rewrite-template-tools">
    <label>
      Rewrite template
      <select :value="selected" :disabled="disabled" @change="choose">
        <option value="">Choose a template</option>
        <optgroup v-for="source in sources" :key="source" :label="sourceLabels[source]">
          <option
            v-for="filename in controller.catalog[source].files"
            :key="filename"
            :value="`${source}:${filename}`"
            >{{ source === 'bundled' ? filename.replace(/\.conf$/i, '') : filename }}</option
          >
        </optgroup>
      </select>
    </label>
    <div class="detail-actions">
      <button
        type="button"
        class="action-button"
        :disabled="catalogLoading"
        @click="controller.refresh"
        >Refresh templates</button
      >
      <button
        type="button"
        class="action-button"
        :disabled="controller.folder.opening"
        @click="controller.openFolder"
        >Open template folder</button
      >
    </div>
  </div>
  <p v-if="catalogLoading" class="website-help" role="status">Looking for templates…</p>
  <template v-for="source in sources" :key="source">
    <p v-if="controller.catalog[source].error" class="website-help" role="status">
      {{ sourceLabels[source] }} templates could not be loaded.
      {{ controller.catalog[source].error }}
    </p>
  </template>
  <label>
    Nginx rewrite
    <textarea
      :value="rewrite"
      class="website-code"
      rows="6"
      placeholder="try_files $uri $uri/ /index.php?$query_string;"
      spellcheck="false"
      @input="editDraft"
    />
  </label>
  <p v-if="selected" class="website-help" role="status">Loading template…</p>
  <p v-if="error" class="forge-alert forge-alert--error" role="alert">{{ error }}</p>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import {
    rewriteTemplateSources as sources,
    rewriteTemplatesController as controller
  } from './rewriteTemplatesController'
  import { websiteError } from './types'

  const props = defineProps<{ disabled?: boolean }>()
  const rewrite = defineModel<string>({ required: true })
  const sourceLabels = { bundled: 'Bundled', user: 'User' }
  const selected = ref('')
  const error = ref('')
  const catalogLoading = computed(() =>
    sources.some((source) => controller.catalog[source].loading)
  )
  let revision = 0

  function cancelChoice() {
    revision++
    selected.value = ''
  }

  function editDraft(event: Event) {
    cancelChoice()
    error.value = ''
    rewrite.value = (event.target as HTMLTextAreaElement).value
  }

  async function choose(event: Event) {
    const choice = (event.target as HTMLSelectElement).value
    const current = ++revision
    selected.value = choice
    error.value = ''
    if (!choice) return
    const separator = choice.indexOf(':')
    const source = sources.find((item) => item === choice.slice(0, separator))
    const filename = choice.slice(separator + 1)
    if (!source || !controller.catalog[source].files.includes(filename)) {
      cancelChoice()
      return
    }
    const draft = rewrite.value
    try {
      const content = await controller.read({ source, filename })
      if (current === revision && rewrite.value === draft && !props.disabled)
        rewrite.value = content
    } catch (caught) {
      if (current === revision) error.value = websiteError(caught)
    } finally {
      if (current === revision) selected.value = ''
    }
  }

  watch(
    () => props.disabled,
    (disabled) => {
      if (disabled) cancelChoice()
    }
  )
  onMounted(controller.refresh)
  onBeforeUnmount(cancelChoice)
</script>

<style scoped>
  .rewrite-template-tools {
    display: flex;
    align-items: end;
    flex-wrap: wrap;
    gap: 8px;
  }
  .rewrite-template-tools label {
    flex: 1 0 190px;
  }
</style>
