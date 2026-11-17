<template>
  <el-card
    style="--el-card-padding: 12px 10px"
    shadow="never"
    class="app-container-aside app-base-el-card w-[240px] overflow-hidden"
  >
    <template #header>
      <div class="flex items-center justify-between">
        <span class="text-[12px]">{{ I18nT('podman.Machine') }}</span>
        <el-button
          link
          :icon="Plus"
          :aria-label="I18nT('common.action.add')"
          @click.stop="addMachine(undefined)"
        ></el-button>
      </div>
    </template>
    <template #default>
      <div class="overflow-hidden h-full flex flex-col">
        <el-scrollbar class="flex-1 overflow-hidden">
          <div class="w-full flex flex-col gap-7">
            <div class="flex flex-col">
              <template v-if="mechineEmpty">
                <el-empty :image-size="28"></el-empty>
              </template>
              <template v-else>
                <template v-for="(item, _index) in mechine" :key="_index">
                  <div :class="{ 'is-current': item.name === tab }" class="app-machine-row">
                    <button
                      type="button"
                      class="app-machine-select"
                      :aria-pressed="item.name === tab"
                      :title="item.name"
                      @click.stop="PodmanManager.tabChange(item)"
                    >
                      <span
                        :class="{
                          'text-success': item.run
                        }"
                        class="text-[13px] truncate"
                        >{{ item.name }}</span
                      >
                      <template v-if="item.run">
                        <div
                          class="w-[20px] h-[20px] flex-shrink-0 flex items-center justify-center"
                        >
                          <yb-icon
                            class="text-success w-[15px] h-[15px]"
                            :svg="import('@/svg/play.svg?raw')"
                          />
                        </div>
                      </template>
                      <template v-else-if="item.running">
                        <div
                          class="w-[20px] h-[20px] flex-shrink-0 flex items-center justify-center"
                        >
                          <el-icon class="is-loading"><Loading /></el-icon>
                        </div>
                      </template>
                    </button>
                    <template v-if="!isLinux">
                      <el-dropdown trigger="click">
                        <template #default>
                          <button
                            type="button"
                            class="app-machine-menu"
                            :aria-label="`${I18nT('common.label.action')} · ${item.name}`"
                            @click.stop="emptyClick"
                          >
                            <div class="flex items-center justify-center">
                              <yb-icon
                                :svg="import('@/svg/more1.svg?raw')"
                                width="16"
                                height="16"
                              />
                            </div>
                          </button>
                        </template>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item
                              v-if="!item.run"
                              :disabled="item.running"
                              @click.stop="item.start()"
                            >
                              {{ I18nT('common.action.start') }}
                            </el-dropdown-item>
                            <el-dropdown-item
                              v-else
                              :disabled="item.running"
                              @click.stop="item.stop()"
                            >
                              {{ I18nT('common.action.stop') }}
                            </el-dropdown-item>
                            <el-dropdown-item @click.stop="addMachine(item)">
                              {{ I18nT('common.action.edit') }}
                            </el-dropdown-item>
                            <el-dropdown-item divided @click.stop="item.remove()">
                              <span class="text-danger">{{ I18nT('common.action.delete') }}</span>
                            </el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </template>
                  </div>
                </template>
              </template>
            </div>
          </div>
        </el-scrollbar>
      </div>
    </template>
  </el-card>
</template>
<script lang="ts" setup>
  import { computed } from 'vue'
  import { Loading, Plus } from '@element-plus/icons-vue'
  import { I18nT } from '@lang/index'
  import { PodmanManager } from '@/components/Podman/class/Podman'
  import { emptyClick } from '@/util/Index'
  import { AsyncComponentShow } from '@/util/AsyncComponent'

  let MachineAddVM: any
  import('./machine/machineAdd.vue').then((res) => {
    MachineAddVM = res.default
  })

  const addMachine = (item?: any) => {
    console.log('addMachine', item)
    AsyncComponentShow(MachineAddVM, {
      item
    }).then()
  }

  const isLinux = computed(() => {
    return window.Server.isLinux
  })

  const mechineEmpty = computed(() => {
    return PodmanManager.machine.length === 0
  })

  const mechine = computed(() => {
    return PodmanManager.machine
  })

  const tab = computed({
    get() {
      return PodmanManager.tab
    },
    set(v: string) {
      PodmanManager.tab = v
    }
  })
</script>
