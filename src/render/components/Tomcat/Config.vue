<template>
  <Conf
    ref="conf"
    :type-flag="'tomcat'"
    :default-file="defaultFile"
    :file="file"
    :file-ext="'conf'"
    :show-commond="false"
  >
  </Conf>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import Conf from '@/components/Conf/index.vue'
  import { AppStore } from '@/store/app'
  import { join } from '@/util/path-browserify'
  import { tomcatCatalinaBase } from './setup'

  const props = defineProps<{
    fileName: string
  }>()

  const appStore = AppStore()

  const currentVersion = computed(() => {
    return appStore.config?.server?.tomcat?.current
  })

  const currentBaseDir = computed(() => {
    const version = currentVersion.value
    if (!version?.version || !version.bin) return ''
    return tomcatCatalinaBase({ bin: version.bin, version: version.version })
  })

  const conf = ref()
  const file = computed(() => {
    if (!currentBaseDir.value) {
      return ''
    }
    return join(currentBaseDir.value, `conf/${props.fileName}`)
  })

  const defaultFile = computed(() => {
    if (!currentBaseDir.value) {
      return ''
    }
    return join(currentBaseDir.value, `conf/${props.fileName}.default`)
  })
</script>
