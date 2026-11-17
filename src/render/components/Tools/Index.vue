<template>
  <div class="main-right-panel p-5 overflow-hidden h-screen app-workbench-page">
    <section class="h-full app-tools-surface" :aria-label="I18nT('base.leftTools')">
      <div class="app-tools-layout flex h-full w-full relative overflow-hidden p-3">
        <div class="app-tools-aside h-full w-60 flex-shrink-0 px-3 relative" :style="asideStyle">
          <el-scrollbar>
            <h1 class="app-tools-title">{{ I18nT('base.leftTools') }}</h1>
            <el-tree
              ref="tree"
              :data="asideData"
              node-key="id"
              default-expand-all
              :highlight-current="true"
              :expand-on-click-node="false"
              style="--el-tree-node-content-height: 30px"
              @node-click="onNodeClick"
            >
              <template #default="{ data }">
                <template v-if="data.isTop">
                  <span class="text-muted select-none">{{
                    data.i18nKey ? I18nT(data.i18nKey) : I18nT(`toolType.${data.label}`)
                  }}</span>
                </template>
                <template v-else>
                  <div class="flex items-center gap-3 py-2 overflow-hidden truncate">
                    <yb-icon
                      class="flex-shrink-0"
                      :svg="data?.icon ?? import('@/svg/custom_tool.svg?raw')"
                      width="15"
                      height="15"
                    />
                    <span class="select-none truncate">{{
                      typeof data.label === 'function' ? data.label() : data.label
                    }}</span>
                  </div>
                </template>
              </template>
            </el-tree>
          </el-scrollbar>
        </div>
        <div
          class="app-tools-content h-full flex-1 flex flex-col p-4 overflow-hidden"
          :style="mainStyle"
        >
          <div class="app-tools-toolbar pb-4 flex items-center flex-shrink-0">
            <template v-if="AppToolStore.expand">
              <el-button
                class="app-tools-toggle"
                size="large"
                link
                :aria-label="I18nT('base.leftTools')"
                @click.stop="AppToolStore.expand = !AppToolStore.expand"
              >
                <Fold class="w-6 h-6" />
              </el-button>
            </template>
            <template v-else>
              <el-button
                class="app-tools-toggle"
                size="large"
                link
                :aria-label="I18nT('base.leftTools')"
                @click.stop="AppToolStore.expand = !AppToolStore.expand"
              >
                <Expand class="w-6 h-6" />
              </el-button>
            </template>
            <el-button
              size="large"
              link
              :aria-label="I18nT('tools.AllTools')"
              @click.stop="AppToolStore.id = 'home'"
            >
              <yb-icon :svg="import('@/svg/host.svg?raw')" class="w-6 h-6" />
            </el-button>
            <el-autocomplete
              v-model.trim="AppToolStore.search"
              :fetch-suggestions="querySearch"
              class="mx-4"
              :aria-label="I18nT('common.action.search')"
              :placeholder="I18nT('common.action.search')"
              clearable
              @select="selectTool"
            ></el-autocomplete>
            <el-button
              size="large"
              link
              :aria-label="I18nT('common.action.add')"
              @click.stop="doAdd(undefined)"
            >
              <Plus class="w-6 h-6" />
            </el-button>
          </div>
          <select
            v-model="AppToolStore.id"
            class="app-tools-picker"
            :aria-label="I18nT('base.leftTools')"
          >
            <option value="home">{{ I18nT('tools.AllTools') }}</option>
            <optgroup
              v-for="group in asideData"
              :key="group.label"
              :label="group.i18nKey ? I18nT(group.i18nKey) : I18nT(`toolType.${group.label}`)"
            >
              <option v-for="item in group.children" :key="item.id" :value="item.id">
                {{ typeof item.label === 'function' ? item.label() : item.label }}
              </option>
            </optgroup>
          </select>
          <template v-if="AppToolStore.id === 'home'">
            <el-scrollbar class="flex-1">
              <template v-if="likeData.length > 0">
                <div class="py-3">{{ I18nT('common.category.favorites') }}</div>
                <div
                  class="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                >
                  <template v-for="(item, _index) in likeData" :key="_index">
                    <div
                      class="app-tool-tile overflow-hidden p-2 group relative flex flex-col items-center justify-center py-6 gap-2 cursor-pointer"
                    >
                      <button
                        type="button"
                        class="app-tool-open"
                        :title="typeof item.label === 'function' ? item.label() : item.label"
                        @click.stop="AppToolStore.id = item.id"
                        ><yb-icon
                          :svg="item?.icon ?? import('@/svg/custom_tool.svg?raw')"
                          width="30"
                          height="30"
                        />
                        <span class="truncate px-1 max-w-full">{{
                          typeof item.label === 'function' ? item.label() : item.label
                        }}</span></button
                      >
                      <button
                        type="button"
                        class="app-tool-favorite is-favorite"
                        :aria-label="I18nT('common.category.favorites')"
                        aria-pressed="true"
                        @click.stop="AppToolStore.doUnLike(item)"
                        ><StarFilled
                      /></button>
                      <template v-if="item.isCustom">
                        <div class="app-tool-custom-menu">
                          <el-dropdown placement="top-start" @command="doCustomAction">
                            <button
                              type="button"
                              class="app-tool-menu"
                              :aria-label="I18nT('common.label.action')"
                              @click.stop
                              ><MoreFilled class="w-3 h-3 outline-0"
                            /></button>
                            <template #dropdown>
                              <el-dropdown-menu>
                                <el-dropdown-item :command="{ action: 'edit', item }"
                                  ><EditPen class="w-4 h-4 mr-2" /><span>{{
                                    I18nT('common.action.edit')
                                  }}</span></el-dropdown-item
                                >
                                <el-dropdown-item :command="{ action: 'del', item }"
                                  ><Delete class="w-4 h-4 mr-2" /><span>{{
                                    I18nT('common.action.delete')
                                  }}</span></el-dropdown-item
                                >
                              </el-dropdown-menu>
                            </template>
                          </el-dropdown>
                        </div>
                      </template>
                    </div>
                  </template>
                </div>
              </template>
              <div class="py-3">{{ I18nT('tools.AllTools') }}</div>
              <div
                class="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
              >
                <template v-for="(item, _index) in homeData" :key="_index">
                  <div
                    class="app-tool-tile overflow-hidden p-2 group flex flex-col items-center justify-center py-6 gap-2 cursor-pointer relative"
                  >
                    <button
                      type="button"
                      class="app-tool-open"
                      :title="typeof item.label === 'function' ? item.label() : item.label"
                      @click.stop="AppToolStore.id = item.id"
                      ><yb-icon
                        :svg="item?.icon ?? import('@/svg/custom_tool.svg?raw')"
                        width="30"
                        height="30"
                      />
                      <span class="truncate px-1 max-w-full">{{
                        typeof item.label === 'function' ? item.label() : item.label
                      }}</span></button
                    >
                    <template v-if="likeID.includes(item.id)">
                      <button
                        type="button"
                        class="app-tool-favorite is-favorite"
                        :aria-label="I18nT('common.category.favorites')"
                        aria-pressed="true"
                        @click.stop="AppToolStore.doUnLike(item)"
                        ><StarFilled
                      /></button>
                    </template>
                    <template v-else>
                      <button
                        type="button"
                        class="app-tool-favorite"
                        :aria-label="I18nT('common.category.favorites')"
                        aria-pressed="false"
                        @click.stop="AppToolStore.doLike(item)"
                        ><Star
                      /></button>
                    </template>
                    <template v-if="item.isCustom">
                      <div class="app-tool-custom-menu">
                        <el-dropdown placement="top-start" @command="doCustomAction">
                          <button
                            type="button"
                            class="app-tool-menu"
                            :aria-label="I18nT('common.label.action')"
                            @click.stop
                            ><MoreFilled class="w-3 h-3 outline-0"
                          /></button>
                          <template #dropdown>
                            <el-dropdown-menu>
                              <el-dropdown-item :command="{ action: 'edit', item }"
                                ><EditPen class="w-4 h-4 mr-2" /><span>{{
                                  I18nT('common.action.edit')
                                }}</span></el-dropdown-item
                              >
                              <el-dropdown-item :command="{ action: 'del', item }"
                                ><Delete class="w-4 h-4 mr-2" /><span>{{
                                  I18nT('common.action.delete')
                                }}</span></el-dropdown-item
                              >
                            </el-dropdown-menu>
                          </template>
                        </el-dropdown>
                      </div>
                    </template>
                  </div>
                </template>
              </div>
            </el-scrollbar>
          </template>
          <template v-else>
            <template v-if="typeof toolComponent?.component === 'string'">
              <div class="flex-1 flex flex-col">
                <div style="height: 55px" class="flex items-center justify-between">
                  <div class="flex items-center">
                    <span class="text-xl">{{ toolComponent.label }}</span>
                    <LikeBtn />
                  </div>
                  <el-button link @click.stop="AppToolStore.openUrl(toolComponent.component)">
                    <yb-icon :svg="import('@/svg/http.svg?raw')" class="w-6 h-6" />
                  </el-button>
                </div>
                <webview :src="toolComponent.component" class="flex-1 border-0 outline-0"></webview>
              </div>
            </template>
            <template v-else>
              <component :is="toolComponent?.component" class="flex-1 overflow-hidden">
                <template #like>
                  <LikeBtn />
                </template>
              </component>
            </template>
          </template>
        </div>
      </div>
    </section>
  </div>
</template>

<script lang="ts" setup>
  import { AppToolModules } from '@/core/AppTool'
  import { AppToolStore } from './store'
  import { computed, ref, watch } from 'vue'
  import { type AppToolModuleItem, AppToolType } from '@/core/type'
  import { I18nT } from '@lang/index'
  import {
    Expand,
    Fold,
    Plus,
    Star,
    StarFilled,
    MoreFilled,
    EditPen,
    Delete
  } from '@element-plus/icons-vue'
  import { AsyncComponentShow } from '@/util/AsyncComponent'
  import Base from '@/core/Base'
  import LikeBtn from './like.vue'

  type AsideTreeDataType = {
    isTop: boolean
    label: string
    i18nKey?: string
    children: AppToolModuleItem[]
  }

  const tree = ref()

  const asideStyle = computed(() => {
    if (AppToolStore.expand) {
      return {
        transform: 'translate(0, 0)'
      }
    }
    return {
      width: '0px',
      padding: '0px',
      transform: 'translate(-240px, 0)'
    }
  })

  const mainStyle = computed(() => {
    if (AppToolStore.expand) {
      return undefined
    }
    return {}
  })

  const likeID = computed(() => {
    return AppToolStore.like
  })

  const PlatformToolModules = computed(() => {
    let platform: any = ''
    if (window.Server.isMacOS) {
      platform = 'macOS'
    } else if (window.Server.isWindows) {
      platform = 'Windows'
    } else if (window.Server.isLinux) {
      platform = 'Linux'
    }
    if (!platform) {
      return []
    }
    return AppToolModules.filter((a) => !a.platform || a.platform.includes(platform))
  })

  const asideData = computed(() => {
    const tree: AsideTreeDataType[] = []
    const all = [...AppToolStore.custom, ...PlatformToolModules.value]
    const like = AppToolStore.like
    /**
     * user like
     */
    if (like.length > 0) {
      const likeItem: AsideTreeDataType = {
        isTop: true,
        label: 'Favorites',
        i18nKey: 'common.category.favorites',
        children: []
      }
      for (const id of like) {
        const find = all.find((a) => a.id === id)
        if (find) {
          likeItem.children.push(find)
        }
      }
      tree.push(likeItem)
    }
    /**
     * user custom
     */
    if (AppToolStore.custom.length > 0) {
      const item: AsideTreeDataType = {
        isTop: true,
        label: 'Custom',
        children: [...AppToolStore.custom]
      }
      tree.push(item)
    }
    for (const type of AppToolType) {
      const sub = PlatformToolModules.value.filter((a) => a.type === type)
      if (sub.length > 0) {
        tree.push({
          isTop: true,
          label: type,
          children: sub
        })
      }
    }
    return tree
  })

  const likeData = computed(() => {
    const all = [...AppToolStore.custom, ...PlatformToolModules.value]
    const like = AppToolStore.like
    const arr = []
    if (like.length > 0) {
      for (const id of like) {
        const find = all.find((a) => a.id === id)
        if (find) {
          arr.push(find)
        }
      }
    }
    const search = AppToolStore.search.trim().toLowerCase()
    if (!search) {
      return arr
    }
    return arr.filter((a) => {
      const label = typeof a.label === 'function' ? a.label().toLowerCase() : a.label.toLowerCase()
      return label.includes(search) || search.includes(label)
    })
  })

  const homeData = computed(() => {
    if (AppToolStore.id !== 'home') {
      return []
    }
    const all = [...AppToolStore.custom, ...PlatformToolModules.value]
    const search = AppToolStore.search.trim().toLowerCase()
    if (!search) {
      return all
    }
    return all.filter((a) => {
      const label = typeof a.label === 'function' ? a.label().toLowerCase() : a.label.toLowerCase()
      return label.includes(search) || search.includes(label)
    })
  })

  const toolComponent = computed(() => {
    if (AppToolStore.id === 'home') {
      return undefined
    }
    const all = [...AppToolStore.custom, ...PlatformToolModules.value]
    return all.find((a) => a.id === AppToolStore.id)
  })

  const onNodeClick = (data: any) => {
    AppToolStore.id = data.id
  }

  const searchALL = computed(() => {
    return [...AppToolStore.custom, ...PlatformToolModules.value].map((i) => {
      const value = typeof i.label === 'function' ? i.label() : i.label
      return {
        value,
        check: value.toLowerCase(),
        id: i.id
      }
    })
  })

  const querySearch = (queryString: string, cb: any) => {
    const check = queryString.trim().toLowerCase()
    const results = check
      ? searchALL.value.filter((f: any) => f.check.includes(check) || check.includes(f.check))
      : searchALL.value
    cb(results)
  }

  const selectTool = (item: any) => {
    console.log('selectTool: ', item)
    if (item.id) {
      AppToolStore.id = item.id
    }
  }

  let AddVM: any
  import('./add.vue').then((res) => {
    AddVM = res.default
  })

  const doAdd = (item?: any) => {
    AsyncComponentShow(AddVM, {
      item
    }).then()
  }

  const doCustomAction = (command: { action: 'edit' | 'del'; item: AppToolModuleItem }) => {
    if (command.action === 'edit') {
      AsyncComponentShow(AddVM, {
        item: command.item
      }).then()
    } else {
      Base._Confirm(I18nT('base.areYouSure'), undefined, {
        customClass: 'confirm-del',
        type: 'warning'
      }).then(() => {
        AppToolStore.doDel(command.item)
      })
    }
  }

  watch(
    () => AppToolStore.id,
    (v) => {
      console.log('AppToolStore.id: ', v, tree.value)
      tree?.value?.setCurrentKey(v)
      if (v === 'home') {
        if (tree?.value?.store?.currentNode) {
          tree.value.store.currentNode.isCurrent = false
        }
      }
    }
  )
</script>
