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
    aria-label="Server configuration"
    spellcheck="false"
    @input="emit('update', ($event.target as HTMLTextAreaElement).value)"
  />
  <p v-else-if="!settings" class="empty-copy">This configuration needs to be edited in the raw file.</p>
  <fieldset v-else class="directives" :disabled="readOnly">
    <div v-for="setting in settings" :key="setting.name" class="directive">
      <label>
        <input
          type="checkbox"
          :checked="setting.enabled"
          :disabled="setting.ambiguous"
          @change="change(setting.name, ($event.target as HTMLInputElement).checked, setting.value)"
        />
        <code>{{ setting.name }}</code>
      </label>
      <select
        v-if="setting.options"
        :aria-label="setting.name + ' value'"
        :value="setting.value"
        :disabled="!setting.enabled || setting.ambiguous"
        @change="change(setting.name, true, ($event.target as HTMLSelectElement).value)"
      >
        <option v-if="!setting.options.includes(setting.value)" :value="setting.value">{{ setting.value }}</option>
        <option v-for="value in setting.options" :key="value">{{ value }}</option>
      </select>
      <input
        v-else
        :aria-label="setting.name + ' value'"
        :value="setting.value"
        :disabled="!setting.enabled || setting.ambiguous"
        @change="edit(setting.name, $event)"
      />
      <small v-if="setting.ambiguous">Multiple declarations. Edit the raw file.</small>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { getWebServerSettings, updateWebServerSetting, type WebServer } from './webServerDirectives'

  const props = defineProps<{ engine: WebServer; content: string; readOnly: boolean }>()
  const emit = defineEmits<{ update: [content: string] }>()
  const mode = ref<'raw' | 'common'>('common')
  const settings = computed(() => getWebServerSettings(props.content, props.engine))

  const change = (name: string, enabled: boolean, value: string) => {
    if (!props.readOnly)
      emit('update', updateWebServerSetting(props.content, props.engine, name, enabled, value))
  }

  const edit = (name: string, event: Event) => {
    const input = event.target as HTMLInputElement
    if (props.readOnly) return
    const updated = updateWebServerSetting(props.content, props.engine, name, true, input.value)
    if (updated === props.content) {
      input.value = settings.value?.find((setting) => setting.name === name)?.value ?? input.value
      return
    }
    emit('update', updated)
  }
</script>

<style scoped>
  .config-modes { margin-bottom: 10px; }
  .config-modes [aria-pressed='true'] { text-decoration: underline; }
  .directives { display: grid; gap: 10px; padding: 0; border: 0; }
  .directive { display: grid; grid-template-columns: minmax(0, 1fr) 1fr; align-items: center; gap: 6px 10px; }
  .directive label { display: flex; align-items: center; gap: 8px; }
  .directive > :is(input, select) {
    color: var(--pqt-text);
    background: var(--pqt-field);
    border: 1px solid var(--pqt-border);
    border-radius: 6px;
    padding: 5px 8px;
  }
  .directive small { grid-column: 2; color: var(--pqt-text-muted); }
</style>
