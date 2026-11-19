<template>
  <Conf
    ref="conf"
    :type-flag="'postgresql'"
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
  import { BrewStore } from '@/store/brew'
  import { join, dirname } from '@/util/path-browserify'
  import { postgreSqlDataDirectoryPath } from './lifecycle'

  const store = BrewStore()

  const currentVersion = computed(() => {
    return (
      store.module('postgresql').installed.find((item) => item.run) ??
      store.currentVersion('postgresql')
    )
  })

  const conf = ref()
  const file = computed(() => {
    if (!currentVersion.value?.version || !window.Server?.PostgreSqlDir) {
      return ''
    }
    return join(postgreSqlDataDirectoryPath(currentVersion.value), 'postgresql.conf')
  })

  const defaultFile = computed(() => {
    if (!file.value) {
      return ''
    }
    return join(dirname(file.value), `postgresql.conf.default`)
  })
</script>
