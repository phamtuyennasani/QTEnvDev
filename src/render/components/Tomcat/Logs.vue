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
  import { AppStore } from '@/store/app'
  import { join } from '@/util/path-browserify'
  import { format } from 'date-fns'
  import { tomcatCatalinaBase } from './setup'

  const appStore = AppStore()

  const currentVersion = computed(() => {
    return appStore.config.server?.tomcat?.current
  })

  const currentBaseDir = computed(() => {
    const version = currentVersion.value
    if (!version?.version || !version.bin) return ''
    return tomcatCatalinaBase({ bin: version.bin, version: version.version })
  })

  const currentDate = new Date()
  const formattedDate = format(currentDate, 'yyyy-MM-dd')

  const log = ref()
  const filepath = computed(() => {
    if (!currentBaseDir?.value) {
      return ''
    }
    if (window.Server.isWindows) {
      return join(currentBaseDir.value, `logs/catalina.${formattedDate}.log`)
    }
    return join(currentBaseDir.value, `logs/catalina.out`)
  })
</script>
