<template>
  <div class="host-edit tools">
    <div class="nav p-0">
      <div class="left">
        <span class="text-xl">{{ I18nT('util.toolSSL') }}</span>
        <slot name="like"></slot>
      </div>
      <el-button type="primary" class="shrink0" :loading="running" @click="doSave">{{
        I18nT('common.action.generate')
      }}</el-button>
    </div>

    <el-scrollbar class="flex-1">
      <p v-if="sslOperation.error" class="px-3 py-2 text-red-500" role="alert">{{ sslOperation.error }}</p>
      <p v-if="sslOperation.warning" class="px-3 py-2" role="status">{{ sslOperation.warning }}</p>
      <div class="main-wapper">
        <div class="main flex flex-col gap-7 pt-7">
          <el-input
            v-model.trim="item.domains"
            type="textarea"
            :rows="6"
            resize="none"
            placeholder="Domains (Example: *.mydomain.tld), separated by line."
            :style="{
              '--el-input-border-color': errs['domains'] ? '#cc5441' : null
            }"
          ></el-input>

          <el-input
            v-model="item.root"
            :style="{
              '--el-input-border-color': errs['root'] ? '#cc5441' : null
            }"
            placeholder="Root CA certificate path, if not choose, will create new in SSL certificate save path"
          >
            <template #append>
              <el-button :icon="FolderOpened" @click.stop="chooseRoot('root', true)"></el-button>
            </template>
          </el-input>

          <el-input
            v-model="item.savePath"
            :style="{
              '--el-input-border-color': errs['savePath'] ? '#cc5441' : null
            }"
            placeholder="SSL certificate save path"
          >
            <template #append>
              <el-button :icon="FolderOpened" @click.stop="chooseRoot('save')"></el-button>
            </template>
          </el-input>
        </div>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { dialog } from '@/util/NodeFn'
  import { I18nT } from '@lang/index'
  import { sslOperation } from './Operation'
  import { generateCertificates } from './Controller'
  import { FolderOpened } from '@element-plus/icons-vue'

  interface SSLItem {
    domains: string
    root: string
    savePath: string
  }

  interface Errors {
    domains: boolean
    root: boolean
    savePath: boolean
  }


  // Reactive state
  const running = computed(() => sslOperation.running)
  const item = ref<SSLItem>({
    domains: '',
    root: '',
    savePath: ''
  })
  const errs = ref<Errors>({
    domains: false,
    root: false,
    savePath: false
  })

  // Watch for changes to reset errors
  watch(
    item,
    () => {
      for (const k in errs.value) {
        errs.value[k as keyof Errors] = false
      }
    },
    { deep: true, immediate: true }
  )

  const chooseRoot = async (flag: 'root' | 'save', choosefile = false) => {
    let opt: any = ['openDirectory', 'createDirectory']
    const filters = []
    if (choosefile) {
      opt = ['openFile']
      filters.push({ name: 'ROOT CA Certificate', extensions: ['crt'] })
    }

    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: opt,
      filters: filters.length ? filters : undefined
    })

    if (canceled || filePaths.length === 0) return

    const [path] = filePaths
    if (flag === 'root') {
      item.value.root = path
    } else if (flag === 'save') {
      item.value.savePath = path
    }
  }

  const checkItem = (): boolean => {
    errs.value.domains = item.value.domains.length === 0
    errs.value.savePath = item.value.savePath.length === 0

    return !Object.values(errs.value).some((error) => error)
  }

  const doSave = () => { if (checkItem()) generateCertificates(item.value) }

</script>
