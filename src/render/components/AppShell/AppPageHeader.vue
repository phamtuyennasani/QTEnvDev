<template>
  <header class="app-page-header">
    <div class="app-page-header__copy">
      <p v-if="eyebrow" class="app-page-header__eyebrow">{{ eyebrow }}</p>
      <h1 class="app-page-header__title"
        ><slot name="title">{{ title }}</slot></h1
      >
      <p v-if="description || $slots.description" class="app-page-header__description">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="app-page-header__actions"><slot name="actions" /></div>
  </header>
</template>

<script lang="ts" setup>
  defineProps<{ title?: string; description?: string; eyebrow?: string }>()
</script>
