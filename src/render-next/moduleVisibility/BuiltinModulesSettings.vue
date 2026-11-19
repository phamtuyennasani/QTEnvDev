<template>
  <div class="builtin-visibility">
    <label class="search-box">
      <span aria-hidden="true">⌕</span>
      <input v-model="query" aria-label="Filter built-in modules" placeholder="Filter modules" />
    </label>
    <p v-if="controller.error" class="forge-alert" role="alert">{{ controller.error }}</p>
    <p v-if="!modules.length" class="empty-copy">No modules match this filter.</p>
    <label v-for="module in modules" :key="module.flag" class="module-toggle">
      <span>{{ module.label }}</span>
      <input
        type="checkbox"
        :data-module="module.flag"
        :checked="isBuiltinModuleVisible(module.flag)"
        :disabled="!desktop || Boolean(controller.pending)"
        @change="toggle(module.flag, $event)"
      />
    </label>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { AppModules } from '@/core/App'
  import type { AllAppModule } from '@/core/type'
  import { builtinModuleVisibility as controller } from './controller'
  import { isBuiltinModuleSupported, isBuiltinModuleVisible } from './visibility'

  const query = ref('')
  const desktop = Boolean(window.QTEnvDevNodeAPI)
  const modules = computed(() => {
    const filter = query.value.trim().toLowerCase()
    return AppModules.filter((module) => isBuiltinModuleSupported(module.typeFlag))
      .map(({ typeFlag, label }) => ({
        flag: typeFlag,
        label: (typeof label === 'function' ? label() : label) || typeFlag
      }))
      .filter(({ flag, label }) => label.toLowerCase().includes(filter) || flag.includes(filter))
      .sort((left, right) => left.label.localeCompare(right.label))
  })

  const toggle = (flag: AllAppModule, event: Event) => {
    const checkbox = event.target as HTMLInputElement
    const requested = checkbox.checked
    checkbox.checked = isBuiltinModuleVisible(flag)
    void controller.change(flag, requested)
  }
</script>

<style scoped>
  .builtin-visibility {
    display: grid;
    gap: 8px;
  }

  .module-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--pqt-border);
    border-radius: 7px;
  }

  .module-toggle input {
    accent-color: var(--pqt-accent);
  }
</style>
