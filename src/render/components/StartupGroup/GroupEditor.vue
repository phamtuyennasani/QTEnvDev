<template>
  <el-dialog
    v-model="show"
    :title="group ? I18nT('common.startupGroup.edit') : I18nT('common.startupGroup.add')"
    width="760px"
    class="app-workbench-dialog startup-group-editor-dialog el-dialog-content-flex-1"
    align-center
    destroy-on-close
    :show-close="!saving"
    :close-on-click-modal="!saving"
    :close-on-press-escape="!saving"
  >
    <div class="startup-group-editor-layout">
      <el-steps :active="step" align-center class="startup-group-editor-steps">
        <el-step :title="I18nT('common.startupGroup.basicInfo')" />
        <el-step :title="I18nT('common.startupGroup.selectServices')" />
        <el-step :title="I18nT('common.startupGroup.startOrder')" />
      </el-steps>

      <div class="startup-group-editor-scroll">
        <el-scrollbar>
          <div class="startup-group-editor-body">
            <p v-if="loading" class="startup-group-editor-notice" role="status">
              {{ I18nT('common.startupGroup.loadingCandidates') }}
            </p>
            <div v-if="candidateError" class="startup-group-editor-notice is-error" role="alert">
              <p>{{ I18nT('common.startupGroup.candidateLoadFailed') }}</p>
              <p class="startup-group-editor-error-detail">{{ candidateError }}</p>
              <el-button @click="loadCandidates">
                {{ I18nT('common.startupGroup.retry') }}
              </el-button>
            </div>
            <div
              v-if="saveError"
              ref="saveErrorNotice"
              class="startup-group-editor-notice is-error"
              role="alert"
              tabindex="-1"
            >
              <p>{{ I18nT('common.startupGroup.saveFailed') }}</p>
              <p class="startup-group-editor-error-detail">{{ saveError }}</p>
            </div>
            <el-form v-if="step === 0" label-position="top">
              <el-form-item :label="I18nT('common.label.name')" required>
                <el-input
                  ref="nameInput"
                  v-model="draft.name"
                  maxlength="64"
                  show-word-limit
                  aria-required="true"
                  :aria-invalid="!!nameError"
                  :aria-describedby="`${formId}-name-error`"
                  @blur="nameTouched = true"
                />
                <p :id="`${formId}-name-error`" class="startup-group-name-error" aria-live="polite">
                  {{ nameError }}
                </p>
              </el-form-item>
              <el-form-item :label="I18nT('common.label.description')">
                <el-input
                  v-model="draft.description"
                  type="textarea"
                  :rows="4"
                  maxlength="240"
                  show-word-limit
                />
              </el-form-item>
              <el-form-item :label="I18nT('common.startupGroup.color')">
                <el-color-picker v-model="draft.color" />
              </el-form-item>
              <el-form-item class="startup-group-failure-policy">
                <el-checkbox v-model="draft.continueOnFailure">
                  {{ I18nT('common.startupGroup.continueOnFailure') }}
                </el-checkbox>
              </el-form-item>
            </el-form>

            <div v-else-if="step === 1" class="flex flex-col gap-4 min-h-8 h-full">
              <el-empty
                v-if="candidatesReady && candidates.length === 0"
                :description="I18nT('common.startupGroup.noCandidates')"
              />
              <el-collapse
                v-else
                v-model="expandedCategories"
                class="startup-group-category-collapse"
              >
                <el-collapse-item
                  v-for="category in candidateSections"
                  :key="category.key"
                  :name="category.key"
                >
                  <template #title>
                    <span class="font-semibold pl-2">{{ I18nT(`aside.${category.key}`) }}</span>
                  </template>

                  <el-collapse
                    :model-value="expandedModules[category.key] ?? []"
                    class="startup-group-module-collapse"
                    @update:model-value="setExpandedModules(category.key, $event)"
                  >
                    <el-collapse-item
                      v-for="module in category.modules"
                      :key="module.key"
                      :name="module.key"
                    >
                      <template #title>
                        <span class="font-medium pl-1">{{ module.label }}</span>
                      </template>

                      <div class="startup-group-candidate-grid">
                        <button
                          v-for="candidate in module.items"
                          :key="candidate.key"
                          type="button"
                          class="startup-group-candidate-card"
                          :class="{ 'is-selected': isCandidateSelected(candidate) }"
                          :aria-pressed="isCandidateSelected(candidate)"
                          :disabled="saving"
                          @click="toggleCandidate(candidate)"
                        >
                          <span
                            class="startup-group-candidate-marker"
                            :class="{ 'is-multiple': candidateManager.allowsMultiple(candidate) }"
                            aria-hidden="true"
                          >
                            <el-icon v-if="isCandidateSelected(candidate)"><Check /></el-icon>
                          </span>
                          <span class="startup-group-candidate-copy">
                            <span class="startup-group-candidate-name">
                              {{ candidate.displayName || I18nT('common.startupGroup.noRemark') }}
                            </span>
                            <span class="startup-group-candidate-path">
                              {{ candidate.displayPath }}
                            </span>
                            <span
                              v-if="candidateWarnings.get(candidate.key)?.length"
                              class="startup-group-candidate-warning"
                            >
                              {{ warningLabel(candidate.key) }}
                            </span>
                          </span>
                        </button>
                      </div>
                    </el-collapse-item>
                  </el-collapse>
                </el-collapse-item>
              </el-collapse>
            </div>

            <div v-else>
              <p v-if="draft.items.length" class="startup-group-order-hint">
                {{ I18nT('common.startupGroup.orderHint') }}
              </p>
              <el-empty
                v-if="draft.items.length === 0"
                :description="I18nT('common.startupGroup.emptyMembers')"
              />
              <draggable
                v-else
                v-model="draft.items"
                item-key="id"
                handle=".startup-group-drag-handle"
                class="startup-group-order-list"
                :disabled="saving"
              >
                <template #item="{ element, index }">
                  <div class="startup-group-order-item">
                    <span class="startup-group-order-number">{{ index + 1 }}</span>
                    <yb-icon
                      class="startup-group-drag-handle h-5 w-5 cursor-move"
                      :svg="import('@/svg/handle.svg?raw')"
                    />
                    <span class="startup-group-order-label" :title="itemLabel(element)">{{
                      itemLabel(element)
                    }}</span>
                    <div class="startup-group-order-actions">
                      <el-button
                        :icon="ArrowUp"
                        :disabled="saving || index === 0"
                        :aria-label="`${I18nT('common.startupGroup.moveUp')}: ${itemLabel(element)}`"
                        :title="I18nT('common.startupGroup.moveUp')"
                        @click="moveItem(index, -1)"
                      />
                      <el-button
                        :icon="ArrowDown"
                        :disabled="saving || index === draft.items.length - 1"
                        :aria-label="`${I18nT('common.startupGroup.moveDown')}: ${itemLabel(element)}`"
                        :title="I18nT('common.startupGroup.moveDown')"
                        @click="moveItem(index, 1)"
                      />
                      <el-button
                        link
                        type="danger"
                        :disabled="saving"
                        :aria-label="`${I18nT('common.action.delete')}: ${itemLabel(element)}`"
                        @click="removeItem(element.id)"
                      >
                        {{ I18nT('common.action.delete') }}
                      </el-button>
                    </div>
                  </div>
                </template>
              </draggable>
            </div>
          </div>
        </el-scrollbar>
      </div>
    </div>

    <template #footer>
      <div class="startup-group-editor-footer">
        <el-button :disabled="saving || step === 0" @click="step -= 1">
          {{ I18nT('common.startupGroup.previous') }}
        </el-button>
        <div class="startup-group-editor-footer-actions">
          <el-button :disabled="saving" @click="show = false">{{ I18nT('base.cancel') }}</el-button>
          <el-button v-if="step < 2" type="primary" :disabled="!canContinue" @click="nextStep">
            {{ I18nT('common.startupGroup.next') }}
          </el-button>
          <el-button v-else type="primary" :loading="saving" :disabled="!canContinue" @click="save">
            {{ I18nT('common.action.save') }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
  import { computed, nextTick, onBeforeUnmount, reactive, ref, useId, watch } from 'vue'
  import { ArrowDown, ArrowUp, Check } from '@element-plus/icons-vue'
  import type { InputInstance } from 'element-plus'
  import draggable from 'vuedraggable'

  import { I18nT } from '@lang/index'
  import { AppModuleTypeList, type AllAppModule, type AllAppModuleType } from '@/core/type'
  import { StartupGroup } from './class/StartupGroup'
  import { StartupGroupManager } from './class/StartupGroupManager'
  import type { StartupGroupCandidateData, StartupGroupDraft, StartupGroupItem } from './type'

  const props = defineProps<{
    modelValue: boolean
    group?: StartupGroup
  }>()
  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
    saved: []
  }>()

  const store = StartupGroupManager.store
  const candidateManager = StartupGroupManager.candidate
  const show = computed({
    get: () => props.modelValue,
    set: (value) => {
      if (!value && saving.value) return
      emit('update:modelValue', value)
    }
  })
  const step = ref(0)
  const loading = ref(false)
  const saving = ref(false)
  const candidatesReady = ref(false)
  const candidateError = ref('')
  const saveError = ref('')
  const saveErrorNotice = ref<HTMLElement>()
  const canContinue = computed(() => candidatesReady.value && !loading.value && !saving.value)
  let candidateRequest = 0
  let disposed = false
  const errorMessage = (error: unknown) => (error instanceof Error ? error.message : `${error}`)
  const formId = useId()
  const nameInput = ref<InputInstance>()
  const nameTouched = ref(false)
  const candidates = ref<StartupGroupCandidateData[]>([])
  const selectedKeys = ref<string[]>([])
  const draft = reactive<StartupGroupDraft>({
    name: '',
    description: '',
    color: '#409eff',
    continueOnFailure: false,
    items: []
  })
  const nameError = computed(() =>
    nameTouched.value && !draft.name.trim() ? I18nT('common.startupGroup.nameRequired') : ''
  )
  const validateName = () => {
    nameTouched.value = true
    if (draft.name.trim()) return true
    step.value = 0
    nextTick(() => nameInput.value?.focus())
    return false
  }

  const candidateByKey = computed(
    () => new Map(candidates.value.map((candidate) => [candidate.key, candidate]))
  )

  type CandidateModuleSection = {
    key: AllAppModule
    label: string
    items: StartupGroupCandidateData[]
  }

  type CandidateCategorySection = {
    key: AllAppModuleType
    modules: CandidateModuleSection[]
  }

  const expandedCategories = ref<AllAppModuleType[]>([])
  const expandedModules = reactive<Partial<Record<AllAppModuleType, AllAppModule[]>>>({})

  const candidateSections = computed<CandidateCategorySection[]>(() => {
    const categories = new Map<AllAppModuleType, Map<AllAppModule, CandidateModuleSection>>()

    for (const candidate of candidates.value) {
      let modules = categories.get(candidate.moduleType)
      if (!modules) {
        modules = new Map()
        categories.set(candidate.moduleType, modules)
      }
      const moduleKey = candidate.item.module
      let module = modules.get(moduleKey)
      if (!module) {
        module = { key: moduleKey, label: candidate.moduleLabel, items: [] }
        modules.set(moduleKey, module)
      }
      module.items.push(candidate)
    }

    return AppModuleTypeList.flatMap((key) => {
      const modules = categories.get(key)
      return modules ? [{ key, modules: [...modules.values()] }] : []
    })
  })
  const candidateWarnings = computed(() =>
    candidateManager.warnings(candidates.value, selectedKeys.value)
  )
  const candidateFor = (item: StartupGroupItem) => {
    const candidate = candidateByKey.value.get(StartupGroup.itemKey(item))
    return candidate && candidateManager.matchesItem(candidate, item) ? candidate : undefined
  }

  const isCandidateSelected = (candidate: StartupGroupCandidateData) =>
    selectedKeys.value.includes(candidate.key)

  const toggleCandidate = (candidate: StartupGroupCandidateData) => {
    if (!canContinue.value) return
    selectedKeys.value = candidateManager.toggleSelection(
      selectedKeys.value,
      candidate,
      candidates.value
    )
  }

  const setExpandedModules = (
    category: AllAppModuleType,
    value: string | number | Array<string | number>
  ) => {
    const values = Array.isArray(value) ? value : [value]
    expandedModules[category] = values.map((item) => `${item}` as AllAppModule)
  }

  const itemKey = StartupGroup.itemKey
  const fallbackItemLabel = (item: StartupGroupItem) =>
    item.type === 'service-version'
      ? `${item.module} · ${item.versionBin}`
      : `${item.module} · ${item.projectId}`
  const itemLabel = (item: StartupGroupItem) => candidateFor(item)?.label ?? fallbackItemLabel(item)
  const warningLabel = (key: string) => {
    const warnings = candidateWarnings.value.get(key) ?? []
    return warnings
      .map((warning) =>
        I18nT(
          warning === 'same-port'
            ? 'common.startupGroup.samePortWarning'
            : 'common.startupGroup.sameModuleWarning'
        )
      )
      .join(' · ')
  }

  const loadCandidates = async () => {
    if (loading.value || disposed || !props.modelValue) return
    const request = ++candidateRequest
    const isCurrent = () => !disposed && props.modelValue && request === candidateRequest
    candidateError.value = ''
    candidatesReady.value = false
    loading.value = true
    try {
      const loaded = await StartupGroupManager.runtime.listCandidates()
      if (!isCurrent()) return
      candidates.value = loaded
      draft.items = candidateManager.filterValidItems(draft.items, candidates.value)
      selectedKeys.value = candidateManager.normalizeSelection(
        draft.items.map(itemKey),
        candidates.value
      )
      draft.items = candidateManager.syncSelectedItems(
        draft.items,
        candidates.value,
        selectedKeys.value
      )

      const selected = new Set(selectedKeys.value)
      expandedCategories.value = candidateSections.value
        .filter((category) =>
          category.modules.some((module) =>
            module.items.some((candidate) => selected.has(candidate.key))
          )
        )
        .map((category) => category.key)
      for (const key of Object.keys(expandedModules) as AllAppModuleType[]) {
        delete expandedModules[key]
      }
      for (const category of candidateSections.value) {
        expandedModules[category.key] = category.modules
          .filter((module) => module.items.some((candidate) => selected.has(candidate.key)))
          .map((module) => module.key)
      }
      candidatesReady.value = true
    } catch (error) {
      if (isCurrent()) candidateError.value = errorMessage(error)
    } finally {
      if (isCurrent()) loading.value = false
    }
  }

  watch(
    () => props.modelValue,
    (visible) => {
      candidateRequest += 1
      loading.value = false
      candidatesReady.value = false
      if (!visible) return
      step.value = 0
      nameTouched.value = false
      candidateError.value = ''
      saveError.value = ''
      candidates.value = []
      selectedKeys.value = []
      draft.name = props.group?.name ?? ''
      draft.description = props.group?.description ?? ''
      draft.color = props.group?.color ?? '#409eff'
      draft.continueOnFailure = props.group?.continueOnFailure ?? false
      draft.items = (props.group?.items ?? []).map((item) => ({ ...item }))
      void loadCandidates()
    },
    { immediate: true }
  )
  onBeforeUnmount(() => {
    disposed = true
    candidateRequest += 1
  })

  const syncSelectedItems = () => {
    draft.items = candidateManager.syncSelectedItems(
      draft.items,
      candidates.value,
      selectedKeys.value
    )
  }

  const removeItem = (id: string) => {
    if (saving.value) return
    draft.items = draft.items.filter((item) => item.id !== id)
    selectedKeys.value = draft.items.filter(candidateFor).map(itemKey)
  }

  const moveItem = (index: number, direction: -1 | 1) => {
    if (saving.value) return
    const target = index + direction
    if (target < 0 || target >= draft.items.length) return
    const [item] = draft.items.splice(index, 1)
    draft.items.splice(target, 0, item)
  }

  const nextStep = () => {
    if (!canContinue.value || step.value >= 2) return
    if (step.value === 0 && !validateName()) return
    if (step.value === 1) syncSelectedItems()
    step.value += 1
  }

  const save = async () => {
    if (!canContinue.value || step.value !== 2 || !validateName()) return
    const groupId = props.group?.id
    const data: StartupGroupDraft = {
      name: draft.name.trim(),
      description: draft.description?.trim() || undefined,
      color: draft.color || undefined,
      continueOnFailure: draft.continueOnFailure || undefined,
      items: draft.items.map((item) => ({ ...item }))
    }
    saveError.value = ''
    saving.value = true
    try {
      if (groupId) await store.update(groupId, data)
      else await store.add(data)
    } catch (error) {
      if (!disposed && props.modelValue) {
        saveError.value = errorMessage(error)
        await nextTick()
        saveErrorNotice.value?.focus()
        saveErrorNotice.value?.scrollIntoView({ block: 'nearest' })
      }
      return
    } finally {
      saving.value = false
    }
    if (disposed) return
    emit('saved')
    show.value = false
  }
</script>

<style scoped lang="scss">
  /* Hallmark · component: StartupGroup editor · genre: modern-minimal · theme: design.md */
  :global(.startup-group-editor-dialog) {
    height: min(680px, calc(100dvh - var(--space-lg)));
    margin: 0;
  }
  .startup-group-editor-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .startup-group-editor-steps {
    flex: 0 0 auto;
    margin-bottom: var(--space-md);
    :deep(.el-step__title) {
      font-size: var(--text-sm);
      line-height: 1.5;
      padding: var(--space-2xs) var(--space-3xs) 0;
      overflow-wrap: anywhere;
    }
  }
  .startup-group-editor-scroll {
    flex: 1;
    min-height: 0;
  }
  .startup-group-editor-body {
    padding: var(--space-3xs);
    :deep(.el-form-item__label) {
      color: var(--color-ink);
    }
  }
  .startup-group-name-error {
    width: 100%;
    min-height: 20px;
    margin-top: var(--space-3xs);
    color: var(--color-danger);
    font-size: var(--text-xs);
    line-height: 20px;
  }
  .startup-group-editor-notice {
    display: grid;
    gap: var(--space-2xs);
    margin-bottom: var(--space-sm);
    padding: var(--space-xs);
    border: 1px solid var(--color-rule-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface-muted);
    color: var(--color-ink-muted);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
    &.is-error {
      border-color: var(--color-danger);
      color: var(--color-danger);
    }
    &:focus {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
    :deep(.el-button) {
      justify-self: start;
    }
  }
  .startup-group-editor-error-detail {
    color: var(--color-ink);
    white-space: pre-wrap;
  }
  .startup-group-failure-policy :deep(.el-checkbox) {
    height: auto;
    min-height: var(--size-control);
    align-items: flex-start;
    white-space: normal;
    .el-checkbox__input {
      margin-top: var(--space-3xs);
    }
    .el-checkbox__label {
      white-space: normal;
      line-height: 1.6;
      overflow-wrap: anywhere;
    }
  }
  .startup-group-category-collapse,
  .startup-group-module-collapse {
    border-color: var(--color-rule);
    :deep(.el-collapse-item__header) {
      min-height: var(--size-control);
      height: auto;
      color: var(--color-ink);
      background: transparent;
    }
    :deep(.el-collapse-item__wrap) {
      background: transparent;
      border-color: var(--color-rule);
    }
    :deep(.el-collapse-item__content) {
      padding-bottom: var(--space-xs);
    }
  }
  .startup-group-module-collapse {
    margin-left: var(--space-sm);
  }
  .startup-group-candidate-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2xs);
    padding: var(--space-3xs);
  }
  .startup-group-candidate-card {
    display: flex;
    align-items: flex-start;
    gap: var(--space-xs);
    min-width: 0;
    min-height: var(--size-control);
    padding: var(--space-xs);
    border: 1px solid var(--color-rule-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-ink);
    text-align: start;
    font: inherit;
    cursor: pointer;
    transition: background-color var(--dur-short) var(--ease-out);
    &.is-selected {
      border-color: var(--color-accent);
      background: var(--color-accent-soft);
    }
    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
    &:active {
      background: var(--color-surface-hover);
    }
    @media (hover: hover) {
      &:hover {
        background: var(--color-surface-hover);
      }
    }
  }
  .startup-group-candidate-marker {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    margin-top: 1px;
    border: 1px solid var(--color-rule-strong);
    border-radius: 50%;
    &.is-multiple {
      border-radius: var(--space-3xs);
    }
    .is-selected & {
      border-color: var(--color-accent);
      background: var(--color-accent);
      color: var(--color-accent-ink);
    }
  }
  .startup-group-candidate-copy {
    display: grid;
    gap: var(--space-3xs);
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .startup-group-candidate-name {
    font-weight: 500;
  }
  .startup-group-candidate-path {
    color: var(--color-ink-muted);
    font: var(--text-xs) / 1.6 var(--app-code-font, var(--font-mono));
  }
  .startup-group-candidate-warning {
    color: var(--color-warning);
    font-size: var(--text-xs);
  }
  .startup-group-order-hint {
    margin-bottom: var(--space-sm);
    color: var(--color-ink-muted);
    font-size: var(--text-sm);
  }
  .startup-group-order-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2xs);
  }
  .startup-group-order-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2xs);
    padding: var(--space-2xs);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-sm);
  }
  .startup-group-order-number {
    min-width: var(--space-md);
    color: var(--color-ink-muted);
    font-family: var(--font-mono);
    text-align: center;
  }
  .startup-group-order-label {
    flex: 1;
    min-width: 80px;
    overflow-wrap: anywhere;
  }
  .startup-group-order-actions {
    display: flex;
    gap: var(--space-3xs);
    margin-left: auto;
    :deep(.el-button) {
      min-width: var(--size-control);
      margin-left: 0;
    }
  }
  .startup-group-editor-footer,
  .startup-group-editor-footer-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2xs);
    :deep(.el-button) {
      margin-left: 0;
    }
  }
  .startup-group-editor-footer {
    justify-content: space-between;
  }
  .startup-group-editor-footer-actions {
    margin-left: auto;
  }
  @media (max-width: 600px) {
    .startup-group-candidate-grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .startup-group-module-collapse {
      margin-left: var(--space-2xs);
    }
  }
</style>
