<template>
  <div class="soft-index-panel main-right-panel app-workbench-page">
    <el-radio-group v-model="tab" class="mt-3">
      <template v-for="(item, index) in tabs" :key="index">
        <el-radio-button :label="item" :value="index"></el-radio-button>
      </template>
    </el-radio-group>
    <div class="main-block">
      <Service v-if="tab === 0" type-flag="temporal" title="Temporal">
        <template v-if="isRunning" #tool-left>
          <el-button
            class="button temporal-ui-button"
            link
            :disabled="openingUi"
            style="color: #01cc74"
            :aria-label="temporalUiController.openingLabel ?? 'Open Temporal UI'"
            :title="temporalUiController.openingLabel ?? 'Open Temporal UI'"
            @click.stop="temporalUiController.open()"
          >
            <el-icon v-if="openingUi" class="is-loading">
              <Loading />
            </el-icon>
            <yb-icon
              v-else
              style="width: 20px; height: 20px"
              :svg="import('@/svg/http.svg?raw')"
            ></yb-icon>
          </el-button>
        </template>
      </Service>
      <Manager
        v-else-if="tab === 1"
        type-flag="temporal"
        :has-static="true"
        url="https://github.com/temporalio/temporal/releases"
        title="Temporal"
        :show-brew-lib="false"
        :show-port-lib="false"
      ></Manager>
      <Config v-if="tab === 2"></Config>
      <Logs v-if="tab === 3"></Logs>
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
  import { computed } from 'vue'
  import { Loading } from '@element-plus/icons-vue'
  import { BrewStore } from '@/store/brew'
  import temporalUiController from './UiController'

  const { tab, checkVersion } = AppModuleSetup('temporal')
  const tabs = [
    I18nT('base.service'),
    I18nT('base.versionManager'),
    I18nT('base.configFile'),
    I18nT('base.log')
  ]
  checkVersion()

  const brewStore = BrewStore()
  const openingUi = temporalUiController.opening
  const isRunning = computed(() => brewStore.module('temporal').installed.some((item) => item.run))
</script>

<style lang="scss" scoped>
  .temporal-ui-button {
    width: 40px;
    height: 32px;
    margin-left: 10px;
    padding: 0;
    justify-content: center;
    align-items: center;
  }
</style>
