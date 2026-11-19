<template>
  <div class="detail-actions config-modes">
    <button class="action-button" :aria-pressed="mode === 'common'" @click="mode = 'common'">
      Common settings
    </button>
    <button class="action-button" :aria-pressed="mode === 'raw'" @click="mode = 'raw'">
      Raw file
    </button>
  </div>
  <textarea
    v-if="mode === 'raw'"
    :value="content"
    :readonly="readOnly"
    aria-label="Service environment configuration"
    spellcheck="false"
    @input="emit('update', ($event.target as HTMLTextAreaElement).value)"
  />
  <fieldset v-else class="env-fields" :disabled="readOnly">
    <p v-if="error" class="forge-alert forge-alert--error" role="alert">{{ error }}</p>
    <details v-for="([group, settings], index) in groups" :key="group" :open="index === 0">
      <summary>{{ group }}</summary>
      <div v-for="field in settings" :key="field.name" class="env-field">
        <label :title="field.tips()">
          <input
            type="checkbox"
            :checked="field.enabled"
            :disabled="field.ambiguous"
            @change="update(field, ($event.target as HTMLInputElement).checked, field.value)"
          />
          <code>{{ field.name }}</code>
        </label>
        <div class="env-field-input">
          <select
            v-if="field.options?.length"
            :aria-label="field.name + ' value'"
            :value="field.value"
            :disabled="!field.enabled || field.ambiguous"
            @change="update(field, true, ($event.target as HTMLSelectElement).value)"
          >
            <option
              v-if="!field.options.some((item) => item.value === field.value)"
              :value="field.value"
            >
              {{ field.value }}
            </option>
            <option v-for="item in field.options" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
          <input
            v-else
            :type="field.name === 'N8N_ENCRYPTION_KEY' ? 'password' : 'text'"
            :aria-label="field.name + ' value'"
            :value="field.value"
            :disabled="!field.enabled || field.ambiguous"
            autocomplete="off"
            spellcheck="false"
            @change="edit(field, $event)"
          />
          <button
            v-if="field.isFile || field.isDir"
            type="button"
            class="action-button"
            :aria-label="'Browse for ' + field.name"
            :disabled="!field.enabled || field.ambiguous || choosingPath"
            @click="choosePath(field)"
          >
            Browse…
          </button>
        </div>
        <small v-if="field.ambiguous">Edit this declaration in the raw file.</small>
      </div>
    </details>
  </fieldset>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref } from 'vue'
  import type { CommonSetItem } from '@/components/Conf/setup'
  import { mailpitCommonFields } from '@/components/MailPit/commonFields'
  import { n8nCommonFields } from '@/components/N8N/commonFields'
  import { dialog } from '@/util/NodeFn'
  import { readEnvServiceFields, updateEnvServiceField, type EnvService } from './envServiceDraft'

  const props = defineProps<{ engine: EnvService; content: string; readOnly: boolean }>()
  const emit = defineEmits<{ update: [content: string] }>()
  const mode = ref<'raw' | 'common'>('common')
  const error = ref('')
  const choosingPath = ref(false)
  let mounted = true
  onBeforeUnmount(() => {
    mounted = false
  })

  const schema = computed(() =>
    props.engine === 'n8n' ? n8nCommonFields() : mailpitCommonFields()
  )
  const fields = computed(() => readEnvServiceFields(props.content, props.engine, schema.value))
  const groups = computed(() => {
    const sections = new Map<string, typeof fields.value>()
    for (const field of fields.value) {
      const label = field.type || 'General'
      if (!sections.has(label)) sections.set(label, [])
      sections.get(label)!.push(field)
    }
    return [...sections.entries()]
  })

  const update = (field: CommonSetItem, enabled: boolean, value: string) => {
    if (props.readOnly) return false
    const result = updateEnvServiceField(props.content, props.engine, field, enabled, value)
    if (result === props.content) return false
    emit('update', result)
    return true
  }

  const edit = (field: CommonSetItem, event: Event) => {
    const input = event.target as HTMLInputElement
    if (!update(field, true, input.value)) input.value = field.value
  }

  const choosePath = async (field: CommonSetItem) => {
    if (props.readOnly || choosingPath.value) return
    const { engine, content } = props
    choosingPath.value = true
    error.value = ''
    const current = () =>
      mounted && mode.value === 'common' && engine === props.engine && content === props.content
    try {
      const result = await dialog.showOpenDialog({
        properties: [field.isDir ? 'openDirectory' : 'openFile', 'showHiddenFiles'],
        ...(field.value ? { defaultPath: field.value } : {})
      })
      const path = result.filePaths?.[0]
      if (current() && !result.canceled && path) update(field, true, path)
    } catch {
      if (current()) error.value = 'The path picker could not open.'
    } finally {
      choosingPath.value = false
    }
  }
</script>

<style scoped>
  .config-modes {
    margin-bottom: 10px;
  }
  .config-modes [aria-pressed='true'] {
    text-decoration: underline;
  }
  .env-fields {
    display: grid;
    gap: 10px;
    min-width: 0;
    padding: 0;
    border: 0;
  }
  .env-fields summary {
    cursor: pointer;
    padding: 6px 0;
  }
  .env-field {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 5px 10px;
    align-items: center;
    padding: 4px 0;
  }
  .env-field label {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-wrap: anywhere;
  }
  .env-field-input {
    display: flex;
    gap: 6px;
  }
  .env-field-input > :is(input, select) {
    flex: 1;
    min-width: 0;
    color: var(--pqt-text);
    background: var(--pqt-field);
    border: 1px solid var(--pqt-border);
    border-radius: 6px;
    padding: 5px 8px;
  }
  .env-field small {
    grid-column: 2;
    color: var(--pqt-text-muted);
  }
</style>
