<template>
  <span v-if="!policy.supportedMajor.length" class="text-red-400 text-xs">
    Unsupported Neo4j version
  </span>
  <span v-else-if="manager.discoveringJava" class="text-xs" role="status">Loading Java…</span>
  <el-button v-else-if="manager.javaDiscoveryError" link @click="manager.discoverJava()">
    Retry Java discovery
  </el-button>
  <el-select
    v-else-if="candidates.length"
    :model-value="selectedJava"
    :disabled="item.run || item.running || manager.savingJava[normalizeNeo4jBin(item.bin)]"
    aria-label="Java runtime"
    size="small"
    placeholder="Select Java"
    @change="(path: string) => manager.chooseJava(item.bin, path)"
  >
    <el-option
      v-for="candidate in candidates"
      :key="candidate.path"
      :label="`Java ${manager.candidateMajor(candidate)} · ${candidate.path}`"
      :value="candidate.path"
    />
  </el-select>
  <el-button v-else link type="warning" @click="emit('open-java')">
    Install compatible Java
  </el-button>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { SoftInstalled } from '@/store/brew'
  import { Neo4jManager as manager, normalizeNeo4jBin } from './store'

  const props = defineProps<{ item: SoftInstalled }>()
  const emit = defineEmits<{ 'open-java': [] }>()
  const candidates = computed(() => manager.candidatesForVersion(props.item.version))
  const policy = computed(() => manager.policyForVersion(props.item.version))
  const selectedJava = computed(() => {
    const home = manager.getBinding(props.item.bin)?.javaHome
    return candidates.value.some((candidate) => candidate.path === home) ? home : ''
  })
</script>
