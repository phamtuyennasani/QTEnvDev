<template>
  <div class="soft-index-panel main-right-panel app-workbench-page">
    <el-radio-group v-model="tab" class="mt-3">
      <template v-for="(item, _index) in tabs" :key="_index">
        <el-radio-button :label="item" :value="_index"></el-radio-button>
      </template>
    </el-radio-group>
    <div class="main-block">
      <Service v-if="tab === 0" type-flag="postgresql" title="PostgreSQL">
        <template #tool-left>
          <el-button
            v-if="isRunning"
            style="color: #01cc74"
            class="button"
            link
            :disabled="pgAdminOpening"
            @click.stop="pgAdminPanel.open()"
          >
            <el-icon
              v-if="pgAdminOpening"
              class="is-loading"
              style="width: 20px; height: 20px; margin-left: 10px"
            >
              <Loading />
            </el-icon>
            <yb-icon
              v-else
              style="width: 20px; height: 20px; margin-left: 10px"
              :svg="import('@/svg/http.svg?raw')"
            ></yb-icon>
          </el-button>
          <DataDirectoryControls class="pl-4 pr-2" />
        </template>
      </Service>
      <Manager
        v-else-if="tab === 1"
        type-flag="postgresql"
        url="https://www.enterprisedb.com/downloads/postgres-postgresql-downloads"
        title="PostgreSQL"
      ></Manager>
      <Config v-else-if="tab === 2"></Config>
      <Logs v-else-if="tab === 3"></Logs>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import Service from '../ServiceManager/index.vue'
  import Config from './Config.vue'
  import Logs from './Logs.vue'
  import Manager from '../VersionManager/index.vue'
  import { AppModuleSetup } from '@/core/Module'
  import { I18nT } from '@lang/index'
  import { BrewStore } from '@/store/brew'
  import { computed } from 'vue'
  import { Loading } from '@element-plus/icons-vue'
  import DataDirectoryControls from './DataDirectoryControls.vue'
  import pgAdminPanel from './PgAdminPanel'

  const { tab, checkVersion } = AppModuleSetup('postgresql')
  const tabs = [
    I18nT('base.service'),
    I18nT('base.versionManager'),
    I18nT('base.configFile'),
    I18nT('base.log')
  ]
  checkVersion()

  const brewStore = BrewStore()

  const isRunning = computed(() =>
    brewStore.module('postgresql').installed.some((item) => item.run)
  )
  const pgAdminOpening = pgAdminPanel.opening
</script>
