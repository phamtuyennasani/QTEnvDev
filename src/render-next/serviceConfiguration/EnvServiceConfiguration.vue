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
    @input="editRaw(($event.target as HTMLTextAreaElement).value)"
  />
  <fieldset v-else class="env-fields" :disabled="readOnly">
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
            :type="secretFields.has(field.name) ? 'password' : 'text'"
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
            :disabled="!field.enabled || field.ambiguous || configurationPathPicker.choosing"
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
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import type { CommonSetItem } from '@/components/Conf/setup'
  import { mailpitCommonFields } from '@/components/MailPit/commonFields'
  import { meilisearchCommonFields } from '@/components/MeiliSearch/commonFields'
  import { minioCommonFields } from '@/components/Minio/commonFields'
  import { n8nCommonFields } from '@/components/N8N/commonFields'
  import { rustfsCommonFields } from '@/components/Rustfs/commonFields'
  import { readEnvServiceFields, updateEnvServiceField, type EnvService } from './envServiceDraft'
  import { readMeilisearchFields, updateMeilisearchField } from './meilisearchDraft'
  import { configurationPathPicker } from './pathPickerController'

  const props = defineProps<{
    engine: EnvService | 'meilisearch'
    content: string
    readOnly: boolean
  }>()
  const emit = defineEmits<{ update: [content: string] }>()
  const mode = ref<'raw' | 'common'>('common')
  const secretFields = new Set([
    'N8N_ENCRYPTION_KEY',
    'MINIO_ROOT_PASSWORD',
    'master_key',
    'RUSTFS_SECRET_KEY',
    'RUSTFS_KMS_VAULT_TOKEN'
  ])
  let mounted = true
  let revision = 0
  watch(
    [mode, () => props.engine, () => props.content, () => props.readOnly],
    () => {
      revision++
    },
    { flush: 'sync' }
  )
  onBeforeUnmount(() => {
    mounted = false
  })

  const schemas = {
    n8n: n8nCommonFields,
    mailpit: mailpitCommonFields,
    meilisearch: meilisearchCommonFields,
    minio: minioCommonFields,
    rustfs: rustfsCommonFields
  }
  const schema = computed(() => schemas[props.engine]())
  const fields = computed(() =>
    props.engine === 'meilisearch'
      ? readMeilisearchFields(props.content, schema.value)
      : readEnvServiceFields(props.content, props.engine, schema.value)
  )
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
    const result =
      props.engine === 'meilisearch'
        ? updateMeilisearchField(props.content, field, enabled, value)
        : updateEnvServiceField(props.content, props.engine, field, enabled, value)
    if (result === props.content) return false
    emit('update', result)
    return true
  }

  const edit = (field: CommonSetItem, event: Event) => {
    const input = event.target as HTMLInputElement
    if (!update(field, true, input.value)) input.value = field.value
  }

  const editRaw = (value: string) => {
    if (props.readOnly) return
    const eol = props.content.match(/\r\n|\n|\r/)?.[0] ?? '\n'
    emit('update', value.replaceAll('\n', eol))
  }

  const choosePath = (field: CommonSetItem) => {
    if (props.readOnly) return
    const snapshot = revision
    const isCurrent = () => mounted && !props.readOnly && snapshot === revision
    void configurationPathPicker.choose(
      field.name,
      Boolean(field.isDir),
      field.value,
      isCurrent,
      (path) => {
        update(field, true, path)
      }
    )
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
