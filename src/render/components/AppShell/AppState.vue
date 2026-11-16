<template>
  <div
    class="app-state"
    :data-state="state"
    :role="state === 'error' ? 'alert' : 'status'"
    :aria-busy="state === 'loading'"
  >
    <div class="app-state__mark" aria-hidden="true">{{ mark }}</div>
    <h2 v-if="title" class="app-state__title">{{ title }}</h2>
    <p v-if="description" class="app-state__description">{{ description }}</p>
    <div v-if="$slots.actions" class="app-state__actions"><slot name="actions" /></div>
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'

  const props = withDefaults(
    defineProps<{
      state?: 'empty' | 'loading' | 'error' | 'success'
      title?: string
      description?: string
    }>(),
    { state: 'empty' }
  )
  const mark = computed(() => ({ empty: '—', loading: '…', error: '!', success: '✓' })[props.state])
</script>
