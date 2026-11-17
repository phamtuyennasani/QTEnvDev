<template>
  <el-card class="startup-group-card" shadow="never">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2">
          <yb-icon
            v-if="reorderEnabled"
            class="startup-group-card-drag-handle h-5 w-5 flex-shrink-0 cursor-grab text-zinc-400 active:cursor-grabbing"
            :svg="import('@/svg/handle.svg?raw')"
          />
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span
                class="inline-block h-3 w-3 rounded-full"
                :style="{ backgroundColor: group.color || 'var(--color-accent)' }"
              ></span>
              <strong class="truncate text-base">{{ group.name }}</strong>
            </div>
            <div v-if="group.description" class="mt-1 truncate text-xs text-muted">
              {{ group.description }}
            </div>
          </div>
        </div>
        <el-switch
          class="flex-shrink-0 [--el-switch-on-color:var(--el-color-success)]"
          :model-value="groupRunning"
          :disabled="groupDisabled"
          :before-change="groupBeforeChange"
          :aria-label="group.name"
        />
      </div>
    </template>

    <el-scrollbar v-if="group.items.length" max-height="360px">
      <div class="startup-group-members">
        <div v-for="item in group.items" :key="item.id" class="startup-group-member">
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium">
              {{ memberDisplayTitle(item) }}
            </div>
            <div class="startup-group-member__path truncate" :title="memberPath(item)">
              {{ memberPath(item) }}
            </div>
          </div>
          <el-switch
            class="[--el-switch-on-color:var(--el-color-success)]"
            :model-value="memberRunning(item)"
            :disabled="StartupGroupManager.isMemberDisabled(group, item)"
            :before-change="() => memberBeforeChange(item)"
            :aria-label="memberDisplayTitle(item)"
          />
        </div>
      </div>
    </el-scrollbar>
    <div v-else class="startup-group-member-empty">
      {{ I18nT('common.startupGroup.emptyMembers') }}
    </div>

    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <el-tooltip
          :content="I18nT('common.startupGroup.defaultTooltip')"
          placement="top"
          :show-after="600"
          :trigger-keys="[]"
        >
          <el-checkbox :model-value="isDefault" :disabled="defaultDisabled" @change="defaultChange">
            {{ I18nT('common.startupGroup.default') }}
          </el-checkbox>
        </el-tooltip>
        <div class="flex items-center gap-2">
          <el-tooltip
            :content="I18nT('common.action.edit')"
            placement="top"
            :show-after="600"
            :trigger-keys="[]"
          >
            <el-button
              :icon="Edit"
              :aria-label="I18nT('common.action.edit')"
              size="small"
              @click="emit('edit', group)"
            />
          </el-tooltip>
          <el-tooltip
            :content="I18nT('common.action.delete')"
            placement="top"
            :show-after="600"
            :trigger-keys="[]"
          >
            <el-button
              :icon="Delete"
              :aria-label="I18nT('common.action.delete')"
              size="small"
              type="danger"
              plain
              @click="emit('delete', group)"
            />
          </el-tooltip>
        </div>
      </div>
    </template>
  </el-card>
</template>

<script lang="ts" setup>
  import { Delete, Edit } from '@element-plus/icons-vue'
  import { computed } from 'vue'

  import { I18nT } from '@lang/index'
  import { StartupGroup } from './class/StartupGroup'
  import { StartupGroupManager } from './class/StartupGroupManager'
  import type { StartupGroupItem } from './type'

  const props = defineProps<{
    group: StartupGroup
    isDefault: boolean
    reorderEnabled?: boolean
  }>()

  const emit = defineEmits<{
    'group-change': [group: StartupGroup, enabled: boolean]
    'member-change': [group: StartupGroup, item: StartupGroupItem, enabled: boolean]
    edit: [group: StartupGroup]
    delete: [group: StartupGroup]
    'default-change': [group: StartupGroup, enabled: boolean]
  }>()

  const groupRunning = computed(() => StartupGroupManager.isGroupRunning(props.group))
  const groupDisabled = computed(
    () =>
      StartupGroupManager.busy ||
      StartupGroupManager.isGroupExecuting(props.group) ||
      props.group.items.length === 0
  )
  const defaultDisabled = computed(() => StartupGroupManager.busy || props.group.items.length === 0)

  const memberPath = (item: StartupGroupItem) => StartupGroupManager.getMemberPath(item)
  const memberDisplayTitle = (item: StartupGroupItem) =>
    StartupGroupManager.getMemberDisplayTitle(item, I18nT('common.startupGroup.noRemark'))
  const memberRunning = (item: StartupGroupItem) => StartupGroupManager.isMemberRunning(item)
  const groupBeforeChange = () => {
    emit('group-change', props.group, !groupRunning.value)
    return false
  }
  const memberBeforeChange = (item: StartupGroupItem) => {
    emit('member-change', props.group, item, !memberRunning(item))
    return false
  }
  const defaultChange = (value: string | number | boolean) =>
    emit('default-change', props.group, value === true)
</script>

<style scoped lang="scss">
  .startup-group-member {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    min-height: 64px;
    padding: var(--space-xs) var(--space-md);
    border-bottom: 1px solid var(--color-rule);
    &:last-child {
      border-bottom: 0;
    }
  }
  .startup-group-member__path {
    margin-top: var(--space-3xs);
    color: var(--color-ink-muted);
    font: var(--text-xs) / 1.5 var(--app-code-font, var(--font-mono));
  }
  .startup-group-member-empty {
    padding: var(--space-md);
    color: var(--color-ink-muted);
  }
  .startup-group-card :deep(.el-card__body) {
    padding: 0;
  }
</style>
