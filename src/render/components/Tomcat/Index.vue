<template>
  <div class="soft-index-panel main-right-panel app-workbench-page">
    <el-radio-group v-model="tab" class="mt-3">
      <template v-for="(item, _index) in tabs" :key="_index">
        <el-radio-button :label="item" :value="_index"></el-radio-button>
      </template>
    </el-radio-group>
    <div class="main-block">
      <Service v-if="tab === 0" type-flag="tomcat" title="Tomcat">
        <template #tool-left>
          <div class="flex items-center gap-1 pl-4">
            <span class="flex-shrink-0">CATALINA_BASE: </span>
            <span
              class="cursor-pointer hover:text-yellow-500 truncate"
              @click.stop="shell.openPath(CATALINA_BASE)"
              >{{ CATALINA_BASE }}</span
            >
            <el-button
              class="flex-shrink-0"
              :disabled="!currentVersion?.bin || !TomcatSetup.state.loaded"
              link
              :icon="Edit"
              @click.stop="chooseDir"
            ></el-button>
          </div>
        </template>
      </Service>
      <Manager
        v-else-if="tab === 1"
        title="Tomcat"
        type-flag="tomcat"
        :has-static="true"
        :show-port-lib="false"
        :show-brew-lib="true"
      ></Manager>
      <Config v-else-if="tab === 2" :file-name="'server.xml'"></Config>
      <Config v-else-if="tab === 3" :file-name="'web.xml'"></Config>
      <Logs v-else-if="tab === 4" type="access_log"></Logs>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import Service from '../ServiceManager/index.vue'
  import Config from './Config.vue'
  import Logs from './Logs.vue'
  import Manager from '../VersionManager/index.vue'
  import { AppModuleSetup } from '@/core/Module'
  import { I18nT } from '@lang/index'
  import { Edit } from '@element-plus/icons-vue'
  import { BrewStore } from '@/store/brew'
  import { TomcatSetup, tomcatCatalinaBase } from '@/components/Tomcat/setup'
  import { chooseFolder } from '@/util/File'
  import { MessageError } from '@/util/Element'
  import { shell } from '@/util/NodeFn'

  const { tab, checkVersion } = AppModuleSetup('tomcat')
  const tabs = [
    I18nT('base.service'),
    I18nT('base.versionManager'),
    'server.xml',
    'web.xml',
    I18nT('base.log')
  ]
  checkVersion()
  void TomcatSetup.load().catch(MessageError)

  const brewStore = BrewStore()

  const currentVersion = computed(() => {
    return brewStore.currentVersion('tomcat')
  })

  const CATALINA_BASE = computed(() =>
    currentVersion.value ? tomcatCatalinaBase(currentVersion.value) : I18nT('base.needSelectVersion')
  )

  const chooseDir = async () => {
    const version = currentVersion.value
    if (!version?.bin) return
    const path = await chooseFolder().catch(() => undefined)
    if (!path || path === tomcatCatalinaBase(version)) return
    await TomcatSetup.setDirectory(version.bin, path, () => currentVersion.value?.bin === version.bin)
      .catch(MessageError)
  }
</script>
