<template>
  <section class="app-surface" :class="`app-surface--${tone}`">
    <slot />
  </section>
</template>

<script lang="ts" setup>
  withDefaults(defineProps<{ tone?: 'default' | 'muted' | 'flat' }>(), { tone: 'default' })
</script>
