<template>
  <div class="detail-facts">
    <div>
      <span>{{ label }}</span>
      <code v-if="path">{{ path }}</code>
      <span v-else>{{ hasVersion ? 'Directory unavailable' : 'Select an installed version' }}</span>
    </div>
  </div>
  <div v-if="path" class="detail-actions">
    <button class="action-button" :disabled="busy" @click="controller.open(flag)">
      Open folder
    </button>
    <button class="action-button" :disabled="busy || !editable" @click="controller.choose(flag)">
      Change directory
    </button>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted } from 'vue'
  import { serviceDirectoryController as controller, type ServiceDirectoryFlag } from './controller'

  const props = defineProps<{ flag: ServiceDirectoryFlag; hasVersion: boolean }>()
  const labels: Partial<Record<ServiceDirectoryFlag, string>> = {
    meilisearch: 'Working directory',
    tomcat: 'CATALINA_BASE'
  }
  const label = computed(() => labels[props.flag] ?? 'Data directory')
  const path = computed(() => controller.path(props.flag))
  const busy = computed(() => controller.busy(props.flag))
  const editable = computed(() => controller.editable(props.flag))
  onMounted(() => controller.load(props.flag))
</script>
