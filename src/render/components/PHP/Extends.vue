<template>
  <el-drawer
    v-model="show"
    size="80%"
    class="app-workbench-drawer"
    :destroy-on-close="true"
    :with-header="false"
    :close-on-click-modal="false"
    @closed="closedFn"
  >
    <div class="php-extensions">
      <div class="nav pl-3 pr-5">
        <button
          type="button"
          class="left app-drawer-close"
          :aria-label="I18nT('base.cancel')"
          @click="show = false"
        >
          <yb-icon :svg="import('@/svg/delete.svg?raw')" class="top-back-icon" />
          <span class="ml-3">{{ I18nT('php.phpExtensions') }}</span>
        </button>
        <el-button-group class="flex-shrink-0">
          <el-tooltip content="php.ini" :show-after="600" :trigger-keys="[]">
            <el-button :aria-label="'php.ini'" :icon="Memo" @click.stop="showIni"></el-button>
          </el-tooltip>
          <el-tooltip v-if="extensionDir" :content="I18nT('base.open')" :show-after="600">
            <el-button
              :aria-label="I18nT('base.open')"
              :icon="Folder"
              :disabled="!extensionDir"
              @click.stop="openDir"
            ></el-button>
          </el-tooltip>
          <el-tooltip v-else-if="extensionDirError" :content="extensionDirError">
            <el-button
              disabled
              :aria-label="I18nT('base.open')"
              :icon="Folder"
              type="danger"
            ></el-button>
          </el-tooltip>
        </el-button-group>
      </div>
      <div class="main-wapper p-3">
        <el-card :body-style="lib === 'lib' ? { padding: '12px' } : undefined">
          <template #header>
            <div class="card-header">
              <div class="left">
                <template v-if="isMacOS">
                  <el-radio-group v-model="lib" size="small">
                    <el-radio-button value="loaded">{{
                      I18nT('php.loadedExtensions')
                    }}</el-radio-button>
                    <template v-if="isHomeBrew">
                      <el-radio-button value="homebrew">Homebrew</el-radio-button>
                    </template>
                    <template v-else-if="isMacPorts">
                      <el-radio-button value="macports">Macports</el-radio-button>
                    </template>
                    <template v-else-if="!isStatic">
                      <el-radio-button value="qtenvdev">{{
                        I18nT('common.value.default')
                      }}</el-radio-button>
                    </template>
                  </el-radio-group>
                </template>
                <template v-else-if="isWindows">
                  <el-radio-group v-model="lib" size="small">
                    <el-radio-button class="flex-1" value="loaded">{{
                      I18nT('php.loadedExtensions')
                    }}</el-radio-button>
                    <el-radio-button
                      class="flex-1"
                      :label="I18nT('common.value.local')"
                      value="local"
                    ></el-radio-button>
                    <el-radio-button
                      class="flex-1"
                      :label="I18nT('php.windowsInstall')"
                      value="lib"
                    ></el-radio-button>
                  </el-radio-group>
                </template>
                <template v-else-if="isLinux">
                  <el-radio-group v-model="lib" size="small">
                    <el-radio-button value="loaded">{{
                      I18nT('php.loadedExtensions')
                    }}</el-radio-button>
                    <template v-if="isHomeBrew">
                      <el-radio-button value="homebrew">Homebrew</el-radio-button>
                    </template>
                  </el-radio-group>
                </template>
              </div>
              <el-button
                class="button"
                :aria-label="I18nT('common.action.refresh')"
                :disabled="loading"
                link
                @click="reFetch"
              >
                <yb-icon
                  :svg="import('@/svg/icon_refresh.svg?raw')"
                  class="refresh-icon"
                  :class="{ 'fa-spin': loading }"
                ></yb-icon>
              </el-button>
            </div>
          </template>

          <template v-if="lib === 'loaded'">
            <LoadedVM :version="version" />
          </template>
          <template v-else-if="lib === 'homebrew'">
            <BrewVM :version="version" />
          </template>
          <template v-else-if="lib === 'macports'">
            <PortsVM :version="version" />
          </template>
          <template v-else-if="lib === 'local'">
            <LocalVM :version="version" />
          </template>
          <template v-else-if="lib === 'lib'">
            <LibVM :version="version" />
          </template>
          <template v-else-if="lib === 'qtenvdev'"> </template>

          <template v-if="showFooter" #footer>
            <template v-if="taskEnd">
              <el-button type="primary" @click.stop="taskConfirm">{{
                I18nT('base.confirm')
              }}</el-button>
            </template>
            <template v-else>
              <el-button @click.stop="taskCancel">{{ I18nT('base.cancel') }}</el-button>
            </template>
          </template>
        </el-card>
      </div>
    </div>
  </el-drawer>
</template>

<script lang="ts" setup>
  import { computed, ref, watch } from 'vue'
  import { type SoftInstalled } from '@/store/brew'
  import { I18nT } from '@lang/index'
  import { AsyncComponentSetup, useAsyncComponentShow } from '@/util/AsyncComponent'
  import BrewVM from './Extension/Homebrew/index.vue'
  import LoadedVM from './Extension/Loaded/index.vue'
  import PortsVM from './Extension/Macports/index.vue'
  import { Setup } from '@/components/PHP/Extension/setup'
  import { join } from '@/util/path-browserify'
  import { fs } from '@/util/NodeFn'
  import { MessageError } from '@/util/Element'
  import { Folder, Memo } from '@element-plus/icons-vue'
  import LocalVM from './Extension/Local/index.vue'
  import LibVM from './Extension/Windows/index.vue'

  const props = defineProps<{
    version: SoftInstalled
  }>()

  const isMacOS = computed(() => {
    return window.Server.isMacOS
  })
  const isWindows = computed(() => {
    return window.Server.isWindows
  })
  const isLinux = computed(() => {
    return window.Server.isLinux
  })

  const { show, onClosed, onSubmit, closedFn } = AsyncComponentSetup()
  const showComponent = useAsyncComponentShow()

  const {
    lib,
    showFooter,
    taskEnd,
    taskConfirm,
    taskCancel,
    loading,
    reFetch,
    extensionDir,
    openDir,
    extensionDirError
  } = Setup(props.version)

  const isMacPorts = computed(() => {
    return props.version?.flag === 'macports'
  })
  const isHomeBrew = computed(() => {
    const cellar = window.Server?.BrewCellar?.replace(/[/\\]+$/, '')
    return Boolean(
      cellar && [props.version.bin, props.version.path, props.version.phpBin].some(
        (path) => path === cellar || path?.startsWith(`${cellar}/`)
      )
    )
  })
  const exists = ref(false)
  watch(
    () => props.version?.phpConfig ?? join(props.version?.path, 'bin/php-config'),
    (v) => {
      if (isMacOS.value && !isHomeBrew.value && !isMacPorts.value) {
        void fs.existsSync(v).then((res) => { exists.value = res }).catch(() => { exists.value = false })
      }
    },
    {
      immediate: true
    }
  )
  const isStatic = computed(() => {
    const pkconfig = props.version?.phpConfig ?? join(props.version?.path, 'bin/php-config')
    return !pkconfig || !exists.value
  })

  const showIni = async () => {
    try {
      const { default: ConfVM } = await import('./Config.vue')
      if (show.value) await showComponent(ConfVM, { version: props.version })
    } catch (error) {
      MessageError(String(error))
    }
  }

  defineExpose({
    show,
    onSubmit,
    onClosed
  })
</script>
