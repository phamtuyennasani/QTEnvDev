<template><Transition name="notice"><div v-if="nextAppState.toast" class="notice-rail"><span class="notice-mark">✓</span><span>{{ nextAppState.toast }}</span></div></Transition></template>
<script setup lang="ts">
import { nextAppState } from '../state/app'
</script>
