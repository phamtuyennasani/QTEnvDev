import { defineComponent as _defineComponent } from 'vue'
import { unref as _unref, toDisplayString as _toDisplayString, createElementVNode as _createElementVNode, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, renderList as _renderList, Fragment as _Fragment, createTextVNode as _createTextVNode, resolveComponent as _resolveComponent, withCtx as _withCtx, createVNode as _createVNode, createBlock as _createBlock, withModifiers as _withModifiers, normalizeStyle as _normalizeStyle } from "vue"

const _hoisted_1 = { class: "h-full min-h-0 flex flex-col overflow-hidden" }
const _hoisted_2 = { class: "mb-4" }
const _hoisted_3 = { class: "font-semibold break-all" }
const _hoisted_4 = { class: "my-2" }
const _hoisted_5 = {
  key: 0,
  class: "text-yellow-600 dark:text-yellow-400 my-2"
}
const _hoisted_6 = { class: "mt-4" }
const _hoisted_7 = { class: "mt-2 list-disc pl-5" }
const _hoisted_8 = { key: 0 }
const _hoisted_9 = {
  key: 0,
  class: "px-5 py-3 border-b border-gray-200 dark:border-gray-700"
}
const _hoisted_10 = { class: "flex items-center justify-between gap-3" }
const _hoisted_11 = {
  key: 0,
  class: "mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-all text-xs",
  "aria-live": "polite"
}
const _hoisted_12 = {
  key: 2,
  class: "w-full h-full overflow-hidden p-5"
}
const _hoisted_13 = {
  key: 0,
  class: "p-5"
}
const _hoisted_14 = ["innerHTML"]
const _hoisted_15 = {
  key: 1,
  class: "p-5"
}
const _hoisted_16 = ["innerHTML"]
const _hoisted_17 = { style: {"padding":"2px 12px 2px 24px","display":"block"} }
const _hoisted_18 = ["onClick"]
const _hoisted_19 = { class: "truncate" }
const _hoisted_20 = { class: "cell-status" }
const _hoisted_21 = {
  key: 0,
  class: "break-all"
}
const _hoisted_22 = {
  key: 0,
  class: "block text-gray-500"
}
const _hoisted_23 = { class: "text-yellow-500 cursor-help inline-flex items-center gap-1" }

import { computed, ref } from 'vue'
  import { homebrewUpgrade } from './Controller'
  import type { BrewUpgradePreview } from '@fork/module/Brew/UpgradeTypes'
  import { I18nT } from '@lang/index'
  import type { AllAppModule } from '@/core/type'
  import { BrewSetup, Setup } from './setup'

  
export default /*@__PURE__*/_defineComponent({
  props: {
    typeFlag: { type: null, required: true }
  },
  setup(__props: any) {

  const props = __props

  const confirmationVisible = ref(false)
  const preview = ref<BrewUpgradePreview>()
  const showLogs = ref(false)
  const upgradeInfo = (row: { name: string }) =>
    homebrewUpgrade.catalog[row.name.includes('/') ? row.name : `homebrew/core/${row.name}`]
  const changesSeries = computed(() =>
    preview.value?.snapshot.installedVersions.some(
      (version) =>
        version.split('.').slice(0, 2).join('.') !==
        preview.value?.snapshot.availableVersion.split('.').slice(0, 2).join('.')
    )
  )
  const operationStatus = computed(() => {
    if (homebrewUpgrade.result?.postprocessError) return I18nT('versionmanager.brewPackagePartial')
    const phase = homebrewUpgrade.phase
    if (phase === 'succeeded')
      return I18nT(
        homebrewUpgrade.refreshFailed
          ? 'versionmanager.brewUpgradeRefreshFailed'
          : homebrewUpgrade.result?.action === 'upgrade'
            ? 'versionmanager.brewUpgradeSuccess'
            : 'versionmanager.brewPackageSuccess'
      )
    return I18nT(`versionmanager.brewUpgradePhase.${phase}`)
  })
  const openUpgrade = async (row: { name: string }) => {
    try {
      preview.value = await homebrewUpgrade.prepare(row.name)
      confirmationVisible.value = true
    } catch {
      /* controller reports the failure */
    }
  }
  const confirmUpgrade = () => {
    if (!preview.value) return
    confirmationVisible.value = false
    showLogs.value = true
    homebrewUpgrade.confirm(preview.value).catch(() => {})
  }

  const {
    xtermDom,
    checkBrew,
    fetching,
    tableData,
    handleBrewVersion,
    installBrew,
    fetchCommand,
    copyCommand,
    formulaConflictTips,
    showBrewError,
    brewError,
    brewBin
  } = Setup(props.typeFlag)

return (_ctx: any,_cache: any) => {
  const _component_el_button = _resolveComponent("el-button")!
  const _component_el_dialog = _resolveComponent("el-dialog")!
  const _component_el_alert = _resolveComponent("el-alert")!
  const _component_el_tooltip = _resolveComponent("el-tooltip")!
  const _component_el_table_column = _resolveComponent("el-table-column")!
  const _component_yb_icon = _resolveComponent("yb-icon")!
  const _component_el_table = _resolveComponent("el-table")!

  return (_openBlock(), _createElementBlock("div", _hoisted_1, [
    _createVNode(_component_el_dialog, {
      modelValue: confirmationVisible.value,
      "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event: any) => ((confirmationVisible).value = $event)),
      title: _unref(I18nT)('versionmanager.brewUpgradeConfirm'),
      width: "min(600px, 90vw)",
      "append-to-body": ""
    }, {
      footer: _withCtx(() => [
        _createVNode(_component_el_button, {
          onClick: _cache[0] || (_cache[0] = ($event: any) => (confirmationVisible.value = false))
        }, {
          default: _withCtx(() => [
            _createTextVNode(_toDisplayString(_unref(I18nT)('base.cancel')), 1 /* TEXT */)
          ]),
          _: 1 /* STABLE */
        }),
        _createVNode(_component_el_button, {
          type: "primary",
          disabled: _unref(homebrewUpgrade).busy,
          onClick: confirmUpgrade
        }, {
          default: _withCtx(() => [
            _createTextVNode(_toDisplayString(_unref(I18nT)('versionmanager.brewUpgradeConfirm')), 1 /* TEXT */)
          ]),
          _: 1 /* STABLE */
        }, 8 /* PROPS */, ["disabled"])
      ]),
      default: _withCtx(() => [
        (preview.value)
          ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [
              _createElementVNode("p", _hoisted_2, _toDisplayString(_unref(I18nT)('versionmanager.brewUpgradeWarning')), 1 /* TEXT */),
              _createElementVNode("p", _hoisted_3, _toDisplayString(preview.value.snapshot.formula), 1 /* TEXT */),
              _createElementVNode("p", _hoisted_4, _toDisplayString(preview.value.snapshot.installedVersions.join(', ')) + " → " + _toDisplayString(preview.value.snapshot.availableVersion), 1 /* TEXT */),
              (changesSeries.value)
                ? (_openBlock(), _createElementBlock("p", _hoisted_5, _toDisplayString(_unref(I18nT)('versionmanager.brewUpgradeSeriesChange')), 1 /* TEXT */))
                : _createCommentVNode("v-if", true),
              _createElementVNode("p", _hoisted_6, _toDisplayString(_unref(I18nT)('versionmanager.brewUpgradeStops')), 1 /* TEXT */),
              _createElementVNode("ul", _hoisted_7, [
                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(preview.value.targets, (target) => {
                  return (_openBlock(), _createElementBlock("li", {
                    key: `${target.module}:${target.item.pid}`,
                    class: "break-all"
                  }, _toDisplayString(target.module) + " " + _toDisplayString(target.item.version) + " — " + _toDisplayString(target.item.bin), 1 /* TEXT */))
                }), 128 /* KEYED_FRAGMENT */)),
                (!preview.value.targets.length)
                  ? (_openBlock(), _createElementBlock("li", _hoisted_8, _toDisplayString(_unref(I18nT)('versionmanager.brewUpgradeNoServices')), 1 /* TEXT */))
                  : _createCommentVNode("v-if", true)
              ])
            ], 64 /* STABLE_FRAGMENT */))
          : _createCommentVNode("v-if", true)
      ]),
      _: 1 /* STABLE */
    }, 8 /* PROPS */, ["modelValue", "title"]),
    (_unref(homebrewUpgrade).busy || _unref(homebrewUpgrade).result)
      ? (_openBlock(), _createElementBlock("div", _hoisted_9, [
          _createElementVNode("div", _hoisted_10, [
            _createElementVNode("span", null, _toDisplayString(operationStatus.value), 1 /* TEXT */),
            _createVNode(_component_el_button, {
              link: "",
              onClick: _cache[2] || (_cache[2] = ($event: any) => (showLogs.value = !showLogs.value))
            }, {
              default: _withCtx(() => [
                _createTextVNode(_toDisplayString(_unref(I18nT)('versionmanager.brewUpgradeLogs')), 1 /* TEXT */)
              ]),
              _: 1 /* STABLE */
            })
          ]),
          (showLogs.value)
            ? (_openBlock(), _createElementBlock("pre", _hoisted_11, _toDisplayString(_unref(homebrewUpgrade).logs) + _toDisplayString(_unref(homebrewUpgrade).error
            ? `
${_unref(homebrewUpgrade).error}`
            : ''), 1 /* TEXT */))
            : _createCommentVNode("v-if", true)
        ]))
      : _createCommentVNode("v-if", true),
    (__props.typeFlag === 'php' && _unref(homebrewUpgrade).catalogError)
      ? (_openBlock(), _createBlock(_component_el_alert, {
          key: 1,
          title: _unref(I18nT)('versionmanager.brewUpgradeCatalogFailed'),
          description: _unref(homebrewUpgrade).catalogError,
          type: "warning",
          closable: false,
          "show-icon": ""
        }, null, 8 /* PROPS */, ["title", "description"]))
      : _createCommentVNode("v-if", true),
    (_unref(BrewSetup).installing)
      ? (_openBlock(), _createElementBlock("div", _hoisted_12, [
          _createElementVNode("div", {
            ref_key: "xtermDom",
            ref: xtermDom,
            class: "w-full h-full overflow-hidden"
          }, null, 512 /* NEED_PATCH */)
        ]))
      : (!_unref(checkBrew))
        ? (_openBlock(), _createElementBlock(_Fragment, { key: 3 }, [
            (_unref(showBrewError))
              ? (_openBlock(), _createElementBlock("div", _hoisted_13, [
                  _createElementVNode("pre", {
                    class: "app-html-block",
                    innerHTML: _unref(I18nT)('versionmanager.brewErrorTips', { bin: _unref(brewBin), error: _unref(brewError) })
                  }, null, 8 /* PROPS */, _hoisted_14)
                ]))
              : (_openBlock(), _createElementBlock("div", _hoisted_15, [
                  _createElementVNode("pre", {
                    class: "app-html-block",
                    innerHTML: _unref(I18nT)('versionmanager.noBrewFound')
                  }, null, 8 /* PROPS */, _hoisted_16),
                  _createVNode(_component_el_button, {
                    type: "primary",
                    class: "mt-5",
                    disabled: _unref(BrewSetup).installing,
                    onClick: _withModifiers(_unref(installBrew), ["stop"])
                  }, {
                    default: _withCtx(() => [
                      _createTextVNode(_toDisplayString(_unref(I18nT)('base.install')), 1 /* TEXT */)
                    ]),
                    _: 1 /* STABLE */
                  }, 8 /* PROPS */, ["disabled", "onClick"])
                ]))
          ], 64 /* STABLE_FRAGMENT */))
        : (_openBlock(), _createBlock(_component_el_table, {
            key: 4,
            height: "100%",
            class: "flex-1 min-h-0",
            data: _unref(tableData),
            border: false,
            "show-overflow-tooltip": "",
            style: {"width":"100%"}
          }, {
            empty: _withCtx(() => [
              (_unref(fetching))
                ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [
                    _createTextVNode(_toDisplayString(_unref(I18nT)('base.gettingVersion')), 1 /* TEXT */)
                  ], 64 /* STABLE_FRAGMENT */))
                : (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                    _createTextVNode(_toDisplayString(_unref(I18nT)('util.noVerionsFoundInLib')), 1 /* TEXT */)
                  ], 64 /* STABLE_FRAGMENT */))
            ]),
            default: _withCtx(() => [
              _createVNode(_component_el_table_column, { prop: "name" }, {
                header: _withCtx(() => [
                  _createElementVNode("span", _hoisted_17, _toDisplayString(_unref(I18nT)('common.label.library')), 1 /* TEXT */)
                ]),
                default: _withCtx((scope) => [
                  _createVNode(_component_el_tooltip, {
                    content: _unref(fetchCommand)(scope.row),
                    "show-after": 600,
                    placement: "top"
                  }, {
                    default: _withCtx(() => [
                      _createElementVNode("span", {
                        class: "hover:text-yellow-500 cursor-pointer truncate",
                        style: {"padding":"2px 12px 2px 24px"},
                        onClick: _withModifiers(($event: any) => (_unref(copyCommand)(scope.row)), ["stop"])
                      }, _toDisplayString(scope.row.name), 9 /* TEXT, PROPS */, _hoisted_18)
                    ]),
                    _: 2 /* DYNAMIC */
                  }, 1032 /* PROPS, DYNAMIC_SLOTS */, ["content"])
                ]),
                _: 1 /* STABLE */
              }),
              _createVNode(_component_el_table_column, {
                prop: "version",
                label: _unref(I18nT)('versionmanager.brewAvailableVersion'),
                width: "150"
              }, {
                default: _withCtx((scope) => [
                  _createElementVNode("span", _hoisted_19, _toDisplayString(scope.row.version), 1 /* TEXT */)
                ]),
                _: 1 /* STABLE */
              }, 8 /* PROPS */, ["label"]),
              _createVNode(_component_el_table_column, {
                align: "center",
                label: _unref(I18nT)('base.isInstalled'),
                width: "170"
              }, {
                default: _withCtx((scope) => [
                  _createElementVNode("div", _hoisted_20, [
                    (upgradeInfo(scope.row)?.installedVersions.length)
                      ? (_openBlock(), _createElementBlock("span", _hoisted_21, [
                          _createTextVNode(_toDisplayString(upgradeInfo(scope.row)?.installedVersions.join(', ')) + " ", 1 /* TEXT */),
                          (upgradeInfo(scope.row)?.reason)
                            ? (_openBlock(), _createElementBlock("small", _hoisted_22, _toDisplayString(_unref(I18nT)(`versionmanager.brewUpgradeReason.${upgradeInfo(scope.row)?.reason}`)), 1 /* TEXT */))
                            : _createCommentVNode("v-if", true)
                        ]))
                      : (scope.row.installed)
                        ? (_openBlock(), _createBlock(_component_yb_icon, {
                            key: 1,
                            svg: import('@/svg/ok.svg?raw'),
                            class: "installed"
                          }))
                        : (scope.row.conflictingFormula)
                          ? (_openBlock(), _createBlock(_component_el_tooltip, {
                              key: 2,
                              content: _unref(formulaConflictTips)(scope.row),
                              placement: "top",
                              "popper-class": "brew-formula-conflict-tooltip"
                            }, {
                              default: _withCtx(() => [
                                _createElementVNode("span", _hoisted_23, [
                                  _createTextVNode(_toDisplayString(_unref(I18nT)('versionmanager.brewFormulaUnavailable')) + " ", 1 /* TEXT */),
                                  _createVNode(_component_yb_icon, {
                                    svg: import('@/svg/question.svg?raw'),
                                    width: "12",
                                    height: "12"
                                  })
                                ])
                              ]),
                              _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["content"]))
                          : _createCommentVNode("v-if", true)
                  ])
                ]),
                _: 1 /* STABLE */
              }, 8 /* PROPS */, ["label"]),
              _createVNode(_component_el_table_column, {
                align: "center",
                label: _unref(I18nT)('common.label.action'),
                width: "170"
              }, {
                default: _withCtx((scope) => [
                  (__props.typeFlag === 'php' && upgradeInfo(scope.row)?.outdated)
                    ? (_openBlock(), _createBlock(_component_el_button, {
                        key: 0,
                        type: "primary",
                        link: "",
                        disabled: 
                _unref(BrewSetup).installing || _unref(homebrewUpgrade).busy || !upgradeInfo(scope.row)?.eligible
              ,
                        onClick: ($event: any) => (openUpgrade(scope.row))
                      }, {
                        default: _withCtx(() => [
                          _createTextVNode(_toDisplayString(_unref(I18nT)('versionmanager.brewUpgrade')), 1 /* TEXT */)
                        ]),
                        _: 1 /* STABLE */
                      }, 8 /* PROPS */, ["disabled", "onClick"]))
                    : _createCommentVNode("v-if", true),
                  _createVNode(_component_el_button, {
                    type: "primary",
                    link: "",
                    style: _normalizeStyle({ opacity: scope.row.version !== undefined ? 1 : 0 }),
                    disabled: 
                _unref(BrewSetup).installing || _unref(homebrewUpgrade).busy || !!scope.row.conflictingFormula
              ,
                    onClick: ($event: any) => (_unref(handleBrewVersion)(scope.row))
                  }, {
                    default: _withCtx(() => [
                      _createTextVNode(_toDisplayString(scope.row.installed ? _unref(I18nT)('common.action.uninstall') : _unref(I18nT)('base.install')), 1 /* TEXT */)
                    ]),
                    _: 2 /* DYNAMIC */
                  }, 1032 /* PROPS, DYNAMIC_SLOTS */, ["style", "disabled", "onClick"])
                ]),
                _: 1 /* STABLE */
              }, 8 /* PROPS */, ["label"])
            ]),
            _: 1 /* STABLE */
          }, 8 /* PROPS */, ["data"]))
  ]))
}
}

})