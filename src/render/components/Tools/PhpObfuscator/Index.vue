<template>
  <div class="host-edit tools">
    <div class="nav p-0">
      <div class="left">
        <span class="text-xl">{{ I18nT('util.toolPhpObfuscator') }}</span>
        <slot name="like"></slot>
      </div>
      <el-button type="primary" class="shrink0" :loading="running" @click="doSave">{{
        I18nT('common.action.generate')
      }}</el-button>
    </div>

    <div class="main-wapper">
      <p v-if="controller.operation.error" class="px-3 py-2 text-red-500" role="alert">{{ controller.operation.error }}</p>
      <el-button v-if="controller.operation.error" class="mx-3" @click="showLogs">View operation logs</el-button>
      <p v-if="controller.operation.warning" class="px-3 py-2" role="status">{{ controller.operation.warning }}</p>
      <div class="main flex flex-col gap-7 pt-7">
        <el-select
          v-model="item.phpversion"
          class="w-full"
          :class="errs['phpversion'] ? ' error' : ''"
          :placeholder="I18nT('php.obfuscatorPhpVersion')"
        >
          <template v-for="(item, _index) in phpVersions" :key="_index">
            <el-option :value="item.path + '-' + item.version" :label="item.version"></el-option>
          </template>
        </el-select>
        <el-input
          v-model="item.src"
          :style="{
            '--el-input-border-color': errs['src'] ? '#cc5441' : null
          }"
          :placeholder="I18nT('php.obfuscatorSrc')"
        >
          <template #append>
            <el-button :icon="FolderOpened" @click.stop="chooseSrc()"></el-button>
          </template>
        </el-input>

        <el-input
          v-model="item.desc"
          :disabled="!descType"
          :style="{
            '--el-input-border-color': errs['desc'] ? '#cc5441' : null
          }"
          :placeholder="I18nT('php.obfuscatorDesc')"
        >
          <template #append>
            <el-button :icon="FolderOpened" @click.stop="chooseDesc()"></el-button>
          </template>
        </el-input>
        <div class="path-choose my-5">
          <el-button @click="showConfig()">{{ I18nT('php.obfuscatorConfig') }}</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { BrewStore } from '@/store/brew'
  import { MessageError } from '@/util/Element'
  import { join } from '@/util/path-browserify'
  import { dialog, fs } from '@/util/NodeFn'
  import { useAsyncComponentShow } from '@/util/AsyncComponent'
  const AsyncComponentShow = useAsyncComponentShow()
  import { I18nT } from '@lang/index'
  import { FolderOpened } from '@element-plus/icons-vue'
  import controller from './Controller'

  const running = computed(() => controller.operation.running)
  const descType = ref('')

  const item = computed(() => controller.item)

  const errs = ref<Record<string, boolean>>({
    phpversion: false,
    src: false,
    desc: false
  })

  const phpVersions = computed(() => {
    return BrewStore()
      .module('php')
      .installed.filter((p) => p.enable && p.num && p?.num > 56)
  })

  watch(
    item,
    () => {
      for (const k in errs.value) {
        errs.value[k] = false
      }
    },
    { deep: true, immediate: true }
  )

  const showConfig = () => {
    if (running.value) return
    import('./Config.vue').then((res) => {
      AsyncComponentShow(res.default, {
        customConfig: item.value.config
      }).then((config) => {
        if (typeof config === 'string') {
          item.value.config = config
        }
      })
    })
  }
  const showLogs = () => {
    import('./Logs.vue').then((result) => {
      AsyncComponentShow(result.default, { content: controller.operation.error })
    })
  }

  const doSave = async () => {
    if (!checkItem() || running.value) {
      return
    }

    const php = phpVersions.value.find((runtime) => runtime.path + '-' + runtime.version === item.value.phpversion)
    if (!php) { MessageError('Choose an installed PHP runtime.'); return }
    await controller.run(php.bin || join(php.path, window.Server.isWindows ? 'php.exe' : 'bin/php'))
    if (controller.operation.done) await controller.reveal()
  }

  const checkItem = () => {
    errs.value.phpversion = item.value.phpversion.length === 0
    errs.value.src = item.value.src.length === 0
    errs.value.desc =
      item.value.desc.length === 0 ||
      item.value.src.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() === item.value.desc.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() ||
      item.value.desc.replace(/\\/g, '/').toLowerCase().startsWith(item.value.src.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() + '/')

    return !Object.values(errs.value).some(Boolean)
  }

  const chooseSrc = async () => {
    if (running.value) return
    const opt = ['openDirectory', 'openFile', 'showHiddenFiles']
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: opt,
      filters: [
        {
          name: 'PHP',
          extensions: ['php']
        }
      ]
    })

    if (canceled || filePaths.length === 0) return

    const [path] = filePaths
    const state: any = await fs.stat(path)

    if (state.isDirectory) {
      descType.value = 'dir'
    } else if (state.isFile) {
      descType.value = 'file'
    } else {
      descType.value = ''
      return
    }

    item.value.src = path
    item.value.desc = ''
  }

  const chooseDesc = async () => {
    if (running.value) return
    if (!descType.value) return

    if (descType.value === 'dir') {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory', 'showHiddenFiles', 'createDirectory']
      })

      if (canceled || filePaths.length === 0) return

      const [path] = filePaths
      item.value.desc = path
    } else {
      const opt = ['showHiddenFiles', 'createDirectory', 'showOverwriteConfirmation']
      const { canceled, filePath } = await dialog.showSaveDialog({
        properties: opt,
        filters: [
          {
            name: 'PHP',
            extensions: ['php']
          }
        ]
      })

      if (canceled || !filePath) return

      item.value.desc = filePath
    }
  }
</script>
