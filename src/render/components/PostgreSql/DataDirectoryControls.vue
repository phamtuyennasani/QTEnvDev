<template>
  <div v-if="controller.supported()" class="postgres-directory">
    <span>{{ I18nT('util.mysqlDataDir') }}</span>
    <code v-if="controller.path">{{ controller.path }}</code>
    <span v-else-if="controller.loaded">{{ I18nT('base.needSelectVersion') }}</span>
    <button
      v-if="controller.path"
      type="button"
      class="action-button"
      :disabled="controller.busy"
      @click="controller.open()"
      >{{ I18nT('base.open') }}</button
    >
    <button
      v-if="controller.path"
      type="button"
      class="action-button"
      :disabled="controller.busy || !controller.editable"
      @click="controller.choose()"
      >{{ I18nT('common.action.edit') }}</button
    >
    <button
      v-if="!controller.loaded && controller.error"
      type="button"
      class="action-button"
      @click="controller.load()"
      >Retry</button
    >
    <span v-if="controller.error" role="alert">{{ controller.error }}</span>
  </div>
</template>

<script setup lang="ts">
  import { watch } from 'vue'
  import { I18nT } from '@lang/index'
  import { postgreSqlDataDirectoryController as controller } from './dataDirectoryController'

  watch(
    () => controller.supported(),
    (supported) => {
      if (supported) void controller.load()
    },
    { immediate: true }
  )
</script>

<style scoped>
  .postgres-directory {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .postgres-directory code {
    overflow-wrap: anywhere;
  }
</style>
