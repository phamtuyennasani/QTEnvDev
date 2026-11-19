<template>
  <div class="sql-config-modes detail-actions">
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
    aria-label="SQL server configuration file"
    spellcheck="false"
    @input="emit('update', ($event.target as HTMLTextAreaElement).value)"
  />
  <fieldset v-else class="sql-config-fields" :disabled="readOnly">
    <div v-for="{ field, value, enabled } in settings" :key="field.name" class="sql-config-field">
      <label>
        <input
          type="checkbox"
          :checked="enabled"
          @change="change(field, ($event.target as HTMLInputElement).checked, value)"
        />
        {{ field.label }}
      </label>
      <input
        :aria-label="field.label + ' value'"
        :value="draft?.name === field.name ? draft.value : value"
        :disabled="!enabled"
        autocomplete="off"
        @input="edit(field, ($event.target as HTMLInputElement).value)"
        @blur="draft = undefined"
      />
    </div>
  </fieldset>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import {
    readSqlField,
    updateSqlField,
    visibleSqlFields,
    type SqlCommonField,
    type SqlEngine
  } from './commonConfig'

  const props = defineProps<{
    content: string
    readOnly: boolean
    engine: SqlEngine
    version: string
    windows: boolean
  }>()
  const emit = defineEmits<{ update: [value: string] }>()
  const mode = ref<'common' | 'raw'>('common')
  const draft = ref<{ name: SqlCommonField['name']; value: string }>()
  const settings = computed(() =>
    visibleSqlFields(props.engine, props.version, props.windows).map((field) => ({
      field,
      ...readSqlField(props.content, props.engine, field)
    }))
  )

  function change(field: SqlCommonField, enabled: boolean, value: string) {
    if (!props.readOnly)
      emit('update', updateSqlField(props.content, props.engine, field, enabled, value))
  }

  function edit(field: SqlCommonField, value: string) {
    draft.value = { name: field.name, value }
    change(field, true, value)
  }
</script>

<style scoped>
  .sql-config-modes {
    margin-bottom: 12px;
  }
  .sql-config-modes [aria-pressed='true'] {
    text-decoration: underline;
  }
  .sql-config-fields {
    display: grid;
    gap: 10px;
    padding: 0;
    border: 0;
  }
  .sql-config-field {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    gap: 10px;
  }
  .sql-config-field label {
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
