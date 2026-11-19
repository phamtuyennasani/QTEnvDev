<template>
  <div class="detail-actions php-config-modes">
    <button class="action-button" :aria-pressed="mode === 'common'" @click="setMode('common')">
      Common settings
    </button>
    <button class="action-button" :aria-pressed="mode === 'raw'" @click="setMode('raw')">
      Raw file
    </button>
  </div>
  <textarea
    v-if="mode === 'raw'"
    :value="content"
    :readonly="readOnly"
    aria-label="PHP configuration file"
    spellcheck="false"
    @input="editRaw(($event.target as HTMLTextAreaElement).value)"
  />
  <fieldset v-else class="php-config-fields" :disabled="readOnly">
    <div
      v-for="{ field, value, enabled, rawOnly } in settings"
      :key="field.name"
      class="php-config-field"
    >
      <label>
        <input
          type="checkbox"
          :checked="enabled"
          :disabled="rawOnly"
          @change="change(field, ($event.target as HTMLInputElement).checked, value)"
        />
        {{ field.name }}
      </label>
      <small v-if="rawOnly">Edit this multiline setting in Raw file.</small>
      <select
        v-else-if="field.options"
        :aria-label="field.name + ' value'"
        :value="value"
        :disabled="!enabled"
        @change="change(field, true, ($event.target as HTMLSelectElement).value)"
      >
        <option v-if="!field.options.includes(value)" :value="value">{{ value }}</option>
        <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
      </select>
      <div v-else class="php-config-value">
        <input
          :aria-label="field.name + ' value'"
          :value="input?.name === field.name ? input.value : value"
          :disabled="!enabled"
          :title="field.kind === 'certificate' ? certificate : undefined"
          autocomplete="off"
          spellcheck="false"
          @input="edit(field, ($event.target as HTMLInputElement).value)"
          @blur="input = undefined"
        />
        <button
          v-if="field.kind"
          class="action-button"
          :aria-label="'Browse for ' + field.name"
          :disabled="!enabled || controller.picking"
          @click="choose(field, value)"
        >
          Browse
        </button>
      </div>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { join } from '@/util/path-browserify'
  import { readPhpSettings, updatePhpField } from './commonConfig'
  import { phpCommonConfigurationController as controller } from './commonConfigurationController'

  const props = defineProps<{ content: string; readOnly: boolean }>()
  const emit = defineEmits<{ update: [value: string] }>()
  const mode = ref<'common' | 'raw'>('common')
  const input = ref<{ name: string; value: string }>()
  const certificate = window.Server.BaseDir ? join(window.Server.BaseDir, 'CA/cacert.pem') : ''
  const settings = computed(() => readPhpSettings(props.content, certificate))
  type Field = Parameters<typeof updatePhpField>[1]
  let active = true
  let revision = 0
  watch(
    () => props.content,
    () => {
      revision++
    },
    { flush: 'sync' }
  )
  watch(
    () => props.readOnly,
    (readOnly) => {
      if (readOnly) {
        input.value = undefined
        revision++
      }
    },
    { flush: 'sync' }
  )
  onMounted(() => {
    void controller.prepareCertificate(certificate)
  })
  onBeforeUnmount(() => {
    active = false
  })

  function setMode(next: typeof mode.value) {
    if (next === mode.value) return
    input.value = undefined
    revision++
    mode.value = next
  }

  function change(field: Field, enabled: boolean, value: string) {
    if (!props.readOnly) emit('update', updatePhpField(props.content, field, enabled, value))
  }

  function edit(field: Field, value: string) {
    input.value = { name: field.name, value }
    change(field, true, value)
  }

  function editRaw(value: string) {
    if (props.readOnly) return
    const eol = props.content.match(/\r\n|\n|\r/)?.[0] ?? '\n'
    emit('update', value.replaceAll('\n', eol))
  }

  function choose(field: Field, value: string) {
    if (props.readOnly) return
    const snapshot = revision
    const isCurrent = () => active && !props.readOnly && snapshot === revision
    void controller.chooseFile(field.name, value, isCurrent, (path) => change(field, true, path))
  }
</script>

<style scoped>
  .php-config-modes {
    margin-bottom: 12px;
  }
  .php-config-modes [aria-pressed='true'] {
    text-decoration: underline;
  }
  .php-config-fields {
    display: grid;
    gap: 10px;
    padding: 0;
    border: 0;
  }
  .php-config-field {
    display: grid;
    grid-template-columns: minmax(135px, 1fr) minmax(0, 2fr);
    align-items: center;
    gap: 10px;
  }
  .php-config-field label,
  .php-config-value {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .php-config-value input {
    flex: 1;
    min-width: 0;
  }
</style>
