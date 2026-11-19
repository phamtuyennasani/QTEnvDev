<template>
  <div class="module-config">
    <el-card>
      <LogVM ref="log" :log-file="filepath" />
      <template #footer>
        <ToolVM :log="log" />
      </template>
    </el-card>
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import LogVM from '@/components/Log/index.vue'
  import ToolVM from '@/components/Log/tool.vue'
  import { BrewStore } from '@/store/brew'
  import { join } from '@/util/path-browserify'
  import { postgreSqlDataDirectoryPath } from './lifecycle'

  const brewStore = BrewStore()

  const currentVersion = computed(() => {
    return (
      brewStore.module('postgresql').installed.find((item) => item.run) ??
      brewStore.currentVersion('postgresql')
    )
  })

  const log = ref()
  const filepath = computed(() => {
    if (!currentVersion.value?.version || !window.Server?.PostgreSqlDir) {
      return ''
    }
    return join(postgreSqlDataDirectoryPath(currentVersion.value), 'pg.log')
  })
</script>
