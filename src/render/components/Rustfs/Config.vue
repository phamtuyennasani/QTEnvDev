<template>
  <Conf
    ref="conf"
    :type-flag="'rustfs'"
    :show-load-default="false"
    :file="file"
    :file-ext="'conf'"
    :show-commond="true"
    url="https://github.com/rustfs/rustfs"
    @on-type-change="onTypeChange"
  >
    <template #common>
      <Common :setting="commonSetting" />
    </template>
  </Conf>
</template>

<script lang="ts" setup>
  import { computed, reactive, Ref, ref, watch } from 'vue'
  import Conf from '@/components/Conf/index.vue'
  import IPC from '@/util/IPC'
  import type { CommonSetItem } from '@/components/Conf/setup'
  import { rustfsCommonFields } from './commonFields'
  import { debounce } from 'lodash-es'
  import Common from '@/components/Conf/common.vue'
  import { uuid } from '@/util/Index'
  import { join } from '@/util/path-browserify'
  import { fs } from '@/util/NodeFn'

  const commonSetting: Ref<CommonSetItem[]> = ref([])
  const conf = ref()
  const index = ref(1)
  const file = computed(() => {
    if (index.value < 0) {
      return ''
    }
    return join(window.Server.BaseDir!, 'rustfs/rustfs.conf')
  })

  const names = rustfsCommonFields()
  let editConfig = ''
  let watcher: any

  const onSettingUpdate = () => {
    let config = editConfig.replace(/\r\n/gm, '\n')
    commonSetting.value.forEach((item) => {
      const regex = new RegExp(`^[\\s\\n#]?([\\s#]*?)${item.name}(.*?)([^\\n])(\\n|$)`, 'gm')
      if (item.enable) {
        const value = `${item.name}=${item.value}`
        if (regex.test(config)) {
          config = config.replace(regex, `${value}\n`)
        } else {
          config = `${value}\n` + config
        }
      } else {
        config = config.replace(regex, ``)
      }
    })
    conf.value.setEditValue(config)
    editConfig = config
  }

  const getCommonSetting = () => {
    if (watcher) {
      watcher()
    }
    const config = editConfig.replace(/\r\n/gm, '\n')
    const arr = [...names].map((item) => {
      const regex = new RegExp(`^[\\s\\n]?((?!#)([\\s]*?))${item.name}(.*?)([^\\n])(\\n|$)`, 'gm')
      const matchs =
        config.match(regex)?.map((s) => {
          const sarr = s
            .trim()
            .split('=')
            .filter((s) => !!s.trim())
            .map((s) => s.trim())
          const k = sarr.shift()
          const v = sarr.join(' ')
          return {
            k,
            v
          }
        }) ?? []
      console.log('getCommonSetting: ', matchs, item.name)
      const find = matchs?.find((m) => m.k === item.name)
      let value = find?.v ?? item.value
      if (item.isString) {
        value = value.replace(new RegExp(`"`, 'g'), '').replace(new RegExp(`'`, 'g'), '')
      }
      item.enable = !!find
      item.value = value
      item.key = uuid()
      return item
    })
    commonSetting.value = reactive(arr) as any
    watcher = watch(commonSetting, debounce(onSettingUpdate, 500), {
      deep: true
    })
  }

  const onTypeChange = (type: 'default' | 'common', config: string) => {
    console.log('onTypeChange: ', type, config)
    if (editConfig !== config || commonSetting.value.length === 0) {
      editConfig = config
      getCommonSetting()
    }
  }
  fs.existsSync(file.value).then((e) => {
    if (!e) {
      IPC.send('app-fork:rustfs', 'initConfig').then((key: string) => {
        IPC.off(key)
        index.value += 1
        conf?.value?.update()
      })
    }
  })
</script>
