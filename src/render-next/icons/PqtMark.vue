<template>
  <svg class="pqt-mark" :width="size" :height="size" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 4.5h8.25A5.75 5.75 0 0 1 19 10.25v3.5a5.75 5.75 0 0 1-5.75 5.75H8.5A3.5 3.5 0 0 1 5 16V4.5Z" :stroke="color" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M5 10.5h5.5M10.5 10.5v7.25M10.5 7.5h8.2" :stroke="color" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M14.7 15.2 18.7 19" :stroke="color" stroke-width="1.8" stroke-linecap="round"/>
  </svg>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string; color?: string }>(), { size: 24, color: 'currentColor' })
</script>
