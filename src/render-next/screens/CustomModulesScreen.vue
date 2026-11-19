<template>
  <section class="screen custom-modules-screen">
    <header class="page-header">
      <div>
        <h1>Custom modules</h1>
        <p class="subtitle">Run commands, manage custom services, and open their configuration files and logs.</p>
      </div>
    </header>
    <div class="panel custom-modules-panel">
      <CustomModulesSettings workspace />
    </div>
  </section>
</template>

<script setup lang="ts">
import CustomModulesSettings from '../custom-modules/CustomModulesSettings.vue'
</script>

<style scoped>
.custom-modules-panel { padding: 18px; }
</style>
