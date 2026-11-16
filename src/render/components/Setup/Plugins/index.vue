<template>
  <div class="app-plugin-market flex h-full min-h-0 flex-col overflow-hidden">
    <div class="shrink-0 px-6 pb-5 pt-5">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div
            class="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center text-[var(--el-color-primary)] bg-[var(--el-color-primary-light-9)]"
          >
            <Box class="w-7 h-7" />
          </div>
          <div>
            <h2 class="text-xl font-bold leading-tight">{{ I18nT('setup.pluginsTitle') }}</h2>
            <p class="text-xs opacity-55 mt-1">{{ I18nT('setup.pluginsDescription') }}</p>
          </div>
        </div>
        <div class="flex min-w-0 flex-wrap items-center gap-3">
          <el-radio-group v-model="tab" :aria-label="I18nT('setup.pluginsTitle')">
            <el-radio-button v-for="t in tabs" :key="t.value" :value="t.value">{{
              t.label
            }}</el-radio-button>
          </el-radio-group>
          <el-button
            :icon="RefreshRight"
            :loading="PluginMarket.loading"
            class="!rounded-lg"
            @click="refresh"
            >{{ I18nT('common.action.refresh') }}</el-button
          >
        </div>
      </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-5 px-6 pb-5">
      <el-alert
        v-if="PluginMarket.error"
        :title="PluginMarket.error"
        type="error"
        :closable="false"
        show-icon
        class="!rounded-lg"
      />
      <el-alert
        v-if="PluginMarket.restartRequired"
        :title="I18nT('setup.pluginsRestartTip')"
        type="info"
        :closable="false"
        show-icon
        class="!rounded-lg"
      />

      <!-- Official catalog -->
      <template v-if="tab === 'official'">
        <div
          class="min-h-0 flex-1 rounded-lg border border-[var(--qtenvdev-light-border)] bg-[var(--qtenvdev-light-surface)] p-4 shadow-[0_2px_10px_var(--qtenvdev-light-shadow)] dark:border-white/10 dark:bg-[var(--main-panel-bg-color)] dark:shadow-none"
        >
          <el-scrollbar class="h-full" view-style="height: 100%">
            <div class="h-full pr-2">
              <div
                v-if="!PluginMarket.loading && official.length === 0"
                class="flex h-full flex-col items-center justify-center px-4 py-16 text-center"
              >
                <div
                  class="w-[88px] h-[88px] rounded-lg flex items-center justify-center text-[var(--el-color-primary)] bg-[var(--el-color-primary-light-9)] shadow-[0_8px_24px_var(--qtenvdev-light-shadow-strong)] dark:shadow-none"
                >
                  <Box class="w-10 h-10" />
                </div>
                <div class="mt-5 text-base font-semibold">{{
                  I18nT('setup.pluginsEmptyOfficial')
                }}</div>
                <div class="mt-1.5 text-[13px] opacity-50">{{
                  I18nT('setup.pluginsDescription')
                }}</div>
                <el-button
                  :icon="RefreshRight"
                  :loading="PluginMarket.loading"
                  class="mt-5"
                  @click="refresh"
                  >{{ I18nT('setup.pluginsCheckAgain') }}</el-button
                >
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="item in official"
                  :key="item.id"
                  class="flex items-start gap-4 rounded-lg border border-[var(--qtenvdev-light-border-light)] bg-[var(--qtenvdev-light-surface)] p-5 shadow-[0_1px_3px_var(--qtenvdev-light-shadow)] transition hover:border-[var(--el-color-primary-light-5)] hover:shadow-[0_6px_18px_var(--qtenvdev-light-shadow-strong)] dark:border-white/5 dark:bg-[var(--main-panel-bg-color)] dark:shadow-none dark:hover:border-[var(--el-color-primary-light-3)] dark:hover:shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
                >
                  <div
                    class="app-plugin-avatar w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center text-xl font-bold select-none"
                  >
                    {{ avatarLetter(item.name) }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-semibold text-[15px]">{{ item.name }}</span>
                      <span
                        class="px-2 py-px rounded-full text-[11px] text-[var(--el-color-primary)] bg-[var(--el-color-primary-light-9)]"
                        >v{{ item.version }}</span
                      >
                      <el-tag size="small" type="success" effect="light" round>Official</el-tag>
                    </div>
                    <div class="text-xs opacity-50 mt-1">{{ item.author || 'QTEnvDev' }}</div>
                    <p class="mt-2 text-[13px] leading-relaxed opacity-60 line-clamp-2">
                      {{ pluginDescription(item) || item.id }}
                    </p>
                  </div>
                  <div
                    class="flex-shrink-0 self-stretch flex flex-col items-end justify-between gap-2"
                  >
                    <span
                      v-if="item.installed"
                      class="inline-flex items-center gap-1.5 text-xs text-green-500"
                    >
                      <span
                        class="w-[7px] h-[7px] rounded-full inline-block bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]"
                      ></span>
                      {{ I18nT('common.state.installed') }}
                    </span>
                    <el-button
                      size="small"
                      :type="actionButtonType(item)"
                      :disabled="item.compatible === false"
                      :icon="licensed ? undefined : Lock"
                      :loading="!!PluginMarket.busyById[item.id]"
                      @click="install(item)"
                      >{{ actionLabel(item) }}</el-button
                    >
                  </div>
                </div>
              </div>
            </div>
          </el-scrollbar>
        </div>
      </template>

      <!-- Installed plugins -->
      <template v-else-if="tab === 'installed'">
        <div
          class="min-h-0 flex-1 rounded-lg border border-[var(--qtenvdev-light-border)] bg-[var(--qtenvdev-light-surface)] p-4 shadow-[0_2px_10px_var(--qtenvdev-light-shadow)] dark:border-white/10 dark:bg-[var(--main-panel-bg-color)] dark:shadow-none"
        >
          <el-scrollbar class="h-full" view-style="height: 100%">
            <div class="h-full pr-2">
              <div
                v-if="PluginMarket.installed.length === 0"
                class="flex h-full flex-col items-center justify-center px-4 py-16 text-center"
              >
                <div
                  class="w-[88px] h-[88px] rounded-lg flex items-center justify-center text-[var(--el-color-primary)] bg-[var(--el-color-primary-light-9)] shadow-[0_8px_24px_var(--qtenvdev-light-shadow-strong)] dark:shadow-none"
                >
                  <Box class="w-10 h-10" />
                </div>
                <div class="mt-5 text-base font-semibold">{{ I18nT('setup.pluginsEmpty') }}</div>
                <div class="mt-1.5 text-[13px] opacity-50">{{
                  I18nT('setup.pluginsDescription')
                }}</div>
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="item in PluginMarket.installed"
                  :key="item.id"
                  class="flex items-start gap-4 rounded-lg border border-[var(--qtenvdev-light-border-light)] bg-[var(--qtenvdev-light-surface)] p-5 shadow-[0_1px_3px_var(--qtenvdev-light-shadow)] transition hover:border-[var(--el-color-primary-light-5)] hover:shadow-[0_6px_18px_var(--qtenvdev-light-shadow-strong)] dark:border-white/5 dark:bg-[var(--main-panel-bg-color)] dark:shadow-none dark:hover:border-[var(--el-color-primary-light-3)] dark:hover:shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
                  :class="{ 'opacity-[0.55]': !item.enabled }"
                >
                  <div
                    class="app-plugin-avatar w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center text-xl font-bold select-none"
                  >
                    {{ avatarLetter(item.name) }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-semibold text-[15px]">{{ item.name }}</span>
                      <span
                        class="px-2 py-px rounded-full text-[11px] text-[var(--el-color-primary)] bg-[var(--el-color-primary-light-9)]"
                        >v{{ item.version }}</span
                      >
                      <el-tag
                        v-if="item.source && item.source !== 'official'"
                        size="small"
                        type="warning"
                        effect="light"
                        round
                        >Third-party</el-tag
                      >
                    </div>
                    <div class="flex items-center gap-1.5 text-xs mt-1.5">
                      <span
                        class="w-[7px] h-[7px] rounded-full inline-block flex-shrink-0"
                        :class="
                          item.enabled
                            ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]'
                            : 'bg-gray-400'
                        "
                      ></span>
                      <span :class="item.enabled ? 'text-green-500' : 'opacity-50'">{{
                        item.enabled
                          ? I18nT('common.state.enabled')
                          : I18nT('common.state.disabled')
                      }}</span>
                    </div>
                    <div class="text-xs opacity-40 mt-1">{{ item.id }}</div>
                    <p
                      v-if="pluginDescription(item)"
                      class="mt-2 text-[13px] leading-relaxed opacity-60 line-clamp-2"
                    >
                      {{ pluginDescription(item) }}
                    </p>
                  </div>
                  <div
                    class="flex-shrink-0 self-stretch flex flex-col items-end justify-between gap-2"
                  >
                    <el-switch
                      :model-value="item.enabled"
                      :loading="!!PluginMarket.busyById[item.id]"
                      @update:model-value="toggle(item, $event)"
                    />
                    <el-button
                      link
                      type="danger"
                      size="small"
                      :icon="Delete"
                      :loading="!!PluginMarket.busyById[item.id]"
                      @click="uninstall(item)"
                      >{{ I18nT('setup.pluginsUninstall') }}</el-button
                    >
                  </div>
                </div>
              </div>
            </div>
          </el-scrollbar>
        </div>
      </template>

      <!-- Third-party sources & catalog -->
      <template v-else>
        <el-scrollbar class="h-full min-h-0 flex-1">
          <div class="flex flex-col gap-5 pr-2">
            <el-alert
              :title="I18nT('setup.pluginsThirdPartyWarning')"
              type="warning"
              :closable="false"
              show-icon
              class="!rounded-lg"
            />

            <div
              class="rounded-lg border border-[var(--qtenvdev-light-border)] bg-[var(--qtenvdev-light-surface)] p-4 shadow-[0_2px_10px_var(--qtenvdev-light-shadow)] dark:border-white/10 dark:bg-[var(--main-panel-bg-color)] dark:shadow-none"
            >
              <div class="text-base font-semibold">{{ I18nT('setup.pluginsAddSourceTitle') }}</div>
              <div class="mt-0.5 text-xs opacity-50">{{ I18nT('setup.pluginsAddSourceDesc') }}</div>
              <div class="mt-3 flex flex-col gap-3 sm:flex-row">
                <el-input
                  v-model="sourceInput"
                  :placeholder="I18nT('setup.pluginsSourcePlaceholder')"
                  class="min-w-0"
                  @keyup.enter="addSource"
                />
                <el-button
                  type="primary"
                  :loading="sourceBusy"
                  class="shrink-0 !rounded-lg"
                  @click="addSource"
                  >{{ I18nT('setup.pluginsAddSource') }}</el-button
                >
              </div>
            </div>

            <div>
              <div class="text-base font-semibold">{{ I18nT('setup.pluginsSourcesTitle') }}</div>
              <div class="mt-0.5 text-xs opacity-50">{{ I18nT('setup.pluginsSourcesDesc') }}</div>
              <div v-if="PluginMarket.sources.length > 0" class="mt-3 space-y-2">
                <div
                  v-for="source in PluginMarket.sources"
                  :key="source.url"
                  class="flex items-center gap-3 rounded-lg border border-[var(--qtenvdev-light-border-light)] bg-[var(--qtenvdev-light-surface)] px-4 py-3 transition-colors hover:border-[var(--el-color-primary-light-5)] dark:border-white/5 dark:bg-[var(--main-panel-bg-color)]"
                >
                  <div
                    class="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-lg bg-[var(--el-color-primary-light-9)] text-[var(--el-color-primary)]"
                  >
                    <Link class="w-4 h-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-medium opacity-80">{{ source.url }}</div>
                    <div
                      class="mt-0.5 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400"
                    >
                      <span class="h-[7px] w-[7px] rounded-full bg-green-500"></span>
                      {{ I18nT('setup.pluginsSourceConnected') }}
                    </div>
                  </div>
                  <el-button
                    link
                    type="danger"
                    size="small"
                    :loading="sourceBusy"
                    class="shrink-0"
                    @click="removeSource(source.url)"
                    >{{ I18nT('common.action.delete') }}</el-button
                  >
                </div>
              </div>
              <el-empty v-else :image-size="80" :description="I18nT('setup.pluginsNoSources')" />
            </div>

            <div>
              <div class="text-base font-semibold">{{ I18nT('setup.pluginsThirdParty') }}</div>
              <div class="mt-0.5 text-xs opacity-50">{{
                I18nT('setup.pluginsThirdPartyDesc')
              }}</div>
              <div v-if="thirdParty.length > 0" class="mt-3 space-y-3">
                <div
                  v-for="item in thirdParty"
                  :key="item.id"
                  class="flex items-start gap-4 rounded-lg border border-[var(--qtenvdev-light-border-light)] bg-[var(--qtenvdev-light-surface)] p-5 shadow-[0_1px_3px_var(--qtenvdev-light-shadow)] transition hover:border-[var(--el-color-primary-light-5)] hover:shadow-[0_6px_18px_var(--qtenvdev-light-shadow-strong)] dark:border-white/5 dark:bg-[var(--main-panel-bg-color)] dark:shadow-none dark:hover:border-[var(--el-color-primary-light-3)] dark:hover:shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
                >
                  <div
                    class="app-plugin-avatar w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center text-xl font-bold select-none"
                  >
                    {{ avatarLetter(item.name) }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-semibold text-[15px]">{{ item.name }}</span>
                      <el-tag size="small" type="warning" effect="light" round>Third-party</el-tag>
                    </div>
                    <div class="text-xs opacity-50 mt-1">
                      {{ item.author || 'QTEnvDev' }} · v{{ item.version }}
                    </div>
                    <p class="mt-2 text-[13px] leading-relaxed opacity-60 line-clamp-2">
                      {{ pluginDescription(item) || item.id }}
                    </p>
                    <div class="flex items-center gap-1.5 text-xs opacity-40 mt-1.5">
                      <Link class="w-3 h-3 shrink-0" />
                      <span class="truncate">{{ item.source }}</span>
                    </div>
                  </div>
                  <div
                    class="flex-shrink-0 self-stretch flex flex-col items-end justify-between gap-2"
                  >
                    <span
                      v-if="item.installed"
                      class="inline-flex items-center gap-1.5 text-xs text-green-500"
                    >
                      <span
                        class="w-[7px] h-[7px] rounded-full inline-block bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]"
                      ></span>
                      {{ I18nT('common.state.installed') }}
                    </span>
                    <el-button
                      size="small"
                      :type="actionButtonType(item)"
                      :disabled="item.compatible === false"
                      :icon="licensed ? undefined : Lock"
                      :loading="!!PluginMarket.busyById[item.id]"
                      @click="install(item)"
                      >{{ actionLabel(item) }}</el-button
                    >
                  </div>
                </div>
              </div>
              <el-empty
                v-else
                :image-size="80"
                :description="I18nT('setup.pluginsNoThirdPartyCatalog')"
              />
            </div>
          </div>
        </el-scrollbar>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onMounted, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Box, Delete, Link, Lock, RefreshRight } from '@element-plus/icons-vue'
  import { I18nT } from '@lang/index'
  import { PluginMarket, pluginDescription, type PluginCatalogItem } from './controller'
  import { SetupStore } from '../store'

  const setupStore = SetupStore()
  const licensed = computed(() => setupStore.isActive)

  const tab = ref('official')
  const sourceInput = ref('')
  const sourceBusy = ref(false)
  const official = computed(() => PluginMarket.catalog.filter((item) => item.official === true))
  const thirdParty = computed(() => PluginMarket.catalog.filter((item) => item.official !== true))

  const tabs = computed(() => [
    { value: 'official', label: I18nT('setup.pluginsOfficial') },
    { value: 'installed', label: I18nT('setup.pluginsInstalled') },
    { value: 'sources', label: I18nT('setup.pluginsThirdParty') }
  ])

  const avatarLetter = (name: string) => (name?.trim()?.[0] ?? '?').toUpperCase()

  const actionLabel = (item: PluginCatalogItem) => {
    if (item.compatible === false) return I18nT('setup.pluginsUpdateQTEnvDev')
    const action = PluginMarket.actionFor(item)
    if (action === 'update') return I18nT('setup.pluginsUpdate')
    if (action === 'reinstall') return I18nT('setup.pluginsReinstall')
    return I18nT('setup.pluginsInstall')
  }

  const refresh = () =>
    PluginMarket.refresh().catch((error) => ElMessage.error(error?.message ?? String(error)))

  const actionButtonType = (item: PluginCatalogItem) => {
    if (!licensed.value) return 'warning'
    return PluginMarket.actionFor(item) === 'update' ? 'warning' : 'primary'
  }

  const install = async (item: PluginCatalogItem) => {
    try {
      if (!licensed.value) {
        await ElMessageBox.confirm(
          I18nT('setup.pluginsLicenseRequiredTips'),
          I18nT('setup.pluginsLicenseRequiredTitle'),
          {
            confirmButtonText: I18nT('base.confirm'),
            cancelButtonText: I18nT('base.cancel'),
            type: 'warning'
          }
        )
          .then(() => {
            setupStore.tab = 'module'
          })
          .catch(() => {})
        return
      }
      if (
        PluginMarket.isThirdParty(item) &&
        !PluginMarket.acknowledgedSources.has(item.source ?? '')
      ) {
        await ElMessageBox.confirm(
          I18nT('setup.pluginsThirdPartyInstallConfirm'),
          I18nT('setup.pluginsTitle'),
          {
            confirmButtonText: I18nT('base.confirm'),
            cancelButtonText: I18nT('base.cancel'),
            type: 'warning'
          }
        )
      }
      await PluginMarket.install(item, true)
      // Hot reload already applied the change; only offer a restart as fallback.
      if (PluginMarket.restartRequired) await askRestart()
    } catch (error: any) {
      if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message ?? String(error))
    }
  }

  const toggle = async (item: PluginCatalogItem, enabled: boolean) => {
    try {
      await PluginMarket.toggle(item, enabled)
      if (PluginMarket.restartRequired) await askRestart()
    } catch (error: any) {
      ElMessage.error(error?.message ?? String(error))
    }
  }

  const uninstall = async (item: PluginCatalogItem) => {
    try {
      await ElMessageBox.confirm(I18nT('setup.pluginsUninstallConfirm'), item.name, {
        type: 'warning'
      })
      await PluginMarket.uninstall(item)
      if (PluginMarket.restartRequired) await askRestart()
    } catch (error: any) {
      if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message ?? String(error))
    }
  }

  const addSource = async () => {
    const url = sourceInput.value.trim()
    if (!url) return
    sourceBusy.value = true
    try {
      await PluginMarket.addSource(url)
      sourceInput.value = ''
    } catch (error: any) {
      ElMessage.error(error?.message ?? String(error))
    } finally {
      sourceBusy.value = false
    }
  }

  const removeSource = async (url: string) => {
    sourceBusy.value = true
    try {
      await PluginMarket.removeSource(url)
    } catch (error: any) {
      ElMessage.error(error?.message ?? String(error))
    } finally {
      sourceBusy.value = false
    }
  }

  const askRestart = () =>
    ElMessageBox.confirm(I18nT('setup.pluginsRestartConfirm'), I18nT('setup.pluginsTitle'), {
      confirmButtonText: I18nT('base.confirm'),
      cancelButtonText: I18nT('base.cancel'),
      type: 'info'
    })
      .then(() => window.QTEnvDevNodeAPI.ipcSendToMain('application:relaunch', 'plugin-relaunch'))
      .catch(() => {})

  onMounted(refresh)
</script>
