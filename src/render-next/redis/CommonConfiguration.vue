<template>
  <div class="redis-config-modes detail-actions">
    <button class="action-button" :aria-pressed="mode === 'common'" @click="mode = 'common'"
      >Common settings</button
    >
    <button class="action-button" :aria-pressed="mode === 'raw'" @click="mode = 'raw'"
      >Raw file</button
    >
  </div>
  <textarea
    v-if="mode === 'raw'"
    :value="content"
    :readonly="readOnly"
    aria-label="Redis configuration file"
    spellcheck="false"
    @input="emit('update', ($event.target as HTMLTextAreaElement).value)"
  />
  <fieldset v-else class="redis-config-fields" :disabled="readOnly">
    <div v-for="{ field, value, enabled } in settings" :key="field.name" class="redis-config-field">
      <label>
        <input
          type="checkbox"
          :checked="enabled"
          @change="change(field, ($event.target as HTMLInputElement).checked, value)"
        />
        {{ field.label }}
      </label>
      <input
        :type="field.name === 'requirepass' ? 'password' : 'text'"
        :aria-label="field.label + ' value'"
        :value="draft?.name === field.name ? draft.value : value"
        :disabled="!enabled"
        autocomplete="off"
        @input="edit(field, ($event.target as HTMLInputElement).value)"
        @blur="draft = undefined"
      />
    </div>
    <small class="website-help"
      >Values use Redis configuration syntax. Quote values that contain spaces.</small
    >
  </fieldset>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import {
    readRedisCommonField,
    redisCommonFields,
    updateRedisCommonField,
    type RedisCommonField
  } from '@/components/Redis/commonConfig'

  const props = defineProps<{ content: string; readOnly: boolean }>()
  const emit = defineEmits<{ update: [value: string] }>()
  const mode = ref<'common' | 'raw'>('common')
  const draft = ref<{ name: RedisCommonField['name']; value: string }>()
  const settings = computed(() =>
    redisCommonFields.map((field) => ({ field, ...readRedisCommonField(props.content, field) }))
  )

  function change(field: RedisCommonField, enabled: boolean, value: string) {
    if (!props.readOnly)
      emit('update', updateRedisCommonField(props.content, field, enabled, value))
  }

  function edit(field: RedisCommonField, value: string) {
    draft.value = { name: field.name, value }
    change(field, true, value)
  }
</script>

<style scoped>
  .redis-config-modes {
    margin-bottom: 12px;
  }
  .redis-config-modes [aria-pressed='true'] {
    text-decoration: underline;
  }
  .redis-config-fields {
    display: grid;
    gap: 10px;
    padding: 0;
    border: 0;
  }
  .redis-config-field {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    gap: 10px;
  }
  .redis-config-field label {
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
