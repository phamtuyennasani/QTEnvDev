import { computed, ref, watch } from 'vue'
import { resolveGroupExecutionRoute } from '@/components/Aside/groupService'
import { StartupGroupManager } from '@/components/StartupGroup/class/StartupGroupManager'
import { buildStartupGroupTrayItems } from '@/components/StartupGroup/tray'
import { AppModules } from '@/core/App'
import { AppCustomerModule } from '@/core/Module'
import type { ModuleInstalledItem } from '@/core/Module/ModuleInstalledItem'
import type { ModuleCustomer } from '@/core/ModuleCustomer'
import { registerLifecycle } from '@/core/RegisterServiceLifecycle'
import type { AllAppModule, AppModuleItem } from '@/core/type'
import CloudflareTunnelStore from '@/core/CloudflareTunnel/CloudflareTunnelStore'
import { AppStore } from '@/store/app'
import { BrewStore } from '@/store/brew'
import IPC from '@/util/IPC'
import type { TrayAction, TrayServiceItem, TrayState } from '@shared/Tray'
import { dnsServer } from '../dnsServer/state'
import { ftpAccounts } from '../ftpAccounts/state'
import { isBuiltinModuleVisible } from '../moduleVisibility/visibility'
import { showNotice } from './app'
import { startupGroupController } from './startupGroupController'

type Action = 'start' | 'stop'
type Service = {
  view: Omit<TrayServiceItem, 'icon'> & { icon: AppModuleItem['icon'] }
  managed: boolean
  custom?: boolean
  change: (action: Action, interactive: boolean) => Promise<string | boolean>
}

// A tray command can outlive its entry screen. The bridge owns admission and
// notices; the existing service owners hold progress and terminal process state.
const active = ref<string>()
let installed = false
const pendingDiscovery = new Map<AllAppModule, Promise<boolean>>()
const visibleBuiltins = computed(() =>
  AppModules.filter((module) => {
    if (!module.isService && !module.isTray) return false
    // Language workspaces contain projects, not implicit tray-start targets.
    if (module.moduleType === 'language' && module.typeFlag !== 'php-fpm') return false
    return isBuiltinModuleVisible(module.typeFlag)
  })
)
const isCustomVisible = (module: ModuleCustomer) =>
  module.isService && AppStore().config.setup.common.showItem?.[module.typeFlag] !== false
const isDesktopReady = () => window.Server?.DataDirectoryReady === true
const isGroupVisible = () => isBuiltinModuleVisible('startup-group')
const defaultGroup = computed(() => {
  const group = startupGroupController.defaultGroup.value
  return resolveGroupExecutionRoute(isGroupVisible(), group) === 'startup-group' ? group : undefined
})

const installedFlag = (flag: AllAppModule) => (flag === 'php-fpm' ? 'php' : flag)
const validVersion = (item: ModuleInstalledItem) => Boolean(item.version && item.bin)
const availableVersion = (item: ModuleInstalledItem) => validVersion(item) && item.enable

function candidates(module: AppModuleItem, versions: ModuleInstalledItem[]) {
  const available = versions.filter(availableVersion)
  const flag = module.typeFlag
  if (flag === 'php-fpm') {
    // PHP-FPM has one listener per version number even when two installs exist.
    const selected = new Set<number | null>()
    return available.filter((item) => {
      if (selected.has(item.num)) return false
      selected.add(item.num)
      return true
    })
  }
  if (module.isOnlyRunOne === false) return available
  const current = AppStore().config.server?.[flag]?.current
  if (!current) return available.slice(0, 1)
  return available
    .filter(
      (item) =>
        item.path === current.path &&
        item.version === current.version &&
        (!current.bin || item.bin === current.bin)
    )
    .slice(0, 1)
}

function label(module: AppModuleItem) {
  return typeof module.label === 'function' ? module.label() : (module.label ?? module.typeFlag)
}

function discover(flag: AllAppModule) {
  const pending = pendingDiscovery.get(flag)
  if (pending) return pending
  const flight = Promise.resolve()
    .then(async () => {
      if (flag === 'dns') return Boolean(dnsServer.status) || dnsServer.refreshStatus()
      if (flag === 'ftp-srv') {
        const controller = ftpAccounts['ftp-srv']
        return Boolean(controller.status) || controller.refreshStatus()
      }
      if (flag === 'cloudflare-tunnel') {
        await CloudflareTunnelStore.init()
        return CloudflareTunnelStore.inited
      }
      return BrewStore().module(installedFlag(flag)).fetchInstalled()
    })
    .catch(() => false)
    .finally(() => pendingDiscovery.delete(flag))
  pendingDiscovery.set(flag, flight)
  return flight
}

async function changeItems<
  T extends {
    run: boolean
    start: (interactive: boolean) => Promise<string | boolean>
    stop: (interactive: boolean) => Promise<string | boolean>
  }
>(items: T[], action: Action, interactive: boolean) {
  const targets = items.filter((item) => item.run === (action === 'stop'))
  const outcomes = await Promise.allSettled(targets.map(async (item) => item[action](interactive)))
  const failures = outcomes.flatMap((outcome) => {
    if (outcome.status === 'rejected') return [String(outcome.reason)]
    if (outcome.value === true) return []
    return [
      typeof outcome.value === 'string' ? outcome.value : 'The service did not confirm the change.'
    ]
  })
  return failures.length ? failures.join('\n') : true
}

function builtinService(module: AppModuleItem): Service {
  const flag = module.typeFlag
  const basic = { id: flag, typeFlag: flag, label: label(module), icon: module.icon, show: true }
  if (flag === 'dns') {
    return {
      view: {
        ...basic,
        run: dnsServer.status?.running === true,
        running: Boolean(dnsServer.busy),
        disabled: !dnsServer.status || Boolean(dnsServer.busy)
      },
      managed: false,
      change: async (action) => (await dnsServer.change(action)) || dnsServer.error || false
    }
  }
  if (flag === 'ftp-srv') {
    const controller = ftpAccounts['ftp-srv']
    return {
      view: {
        ...basic,
        run: controller.status?.running === true,
        running: controller.busy,
        disabled: !controller.status?.installed || controller.busy
      },
      managed: true,
      change: async (action, interactive) => (await controller.change(action, interactive)) || controller.error || false
    }
  }
  if (flag === 'cloudflare-tunnel') {
    const items = CloudflareTunnelStore.items
    const running = items.some((item) => item.running)
    return {
      view: {
        ...basic,
        run: items.some((item) => item.run),
        running,
        disabled: running || !CloudflareTunnelStore.inited || !items.length
      },
      managed: true,
      change: (action, interactive) => changeItems([...items], action, interactive)
    }
  }
  const store = BrewStore().module(installedFlag(flag))
  const versions = store.installed.filter(validVersion)
  const start = candidates(module, versions)
  const run = versions.some((item) => item.run)
  const running = store.fetchInstalleding || store.starting || versions.some((item) => item.running)
  return {
    view: {
      ...basic,
      run,
      running,
      disabled: !store.installedFetched || running || (!run && !start.length)
    },
    managed: Boolean(module.isService),
    async change(action, interactive) {
      await registerLifecycle(flag)
      if (!isBuiltinModuleVisible(flag)) return false
      return changeItems(action === 'start' ? start : versions, action, interactive)
    }
  }
}

function customService(module: ModuleCustomer): Service {
  const running = module.item.some((item) => item.running)
  const run = module.item.some((item) => item.run)
  return {
    view: {
      id: module.id,
      typeFlag: module.typeFlag,
      label: module.label,
      icon: module.icon,
      show: true,
      run,
      running,
      disabled:
        running ||
        !module.item.length ||
        (!run && module.item.some((item) => item.startOutcomeUnknown))
    },
    managed: true,
    custom: true,
    change: (action, interactive) =>
      isCustomVisible(module) ? module[action](interactive) : Promise.resolve(false)
  }
}

const services = computed(() => {
  if (!isDesktopReady()) return []
  return [
    ...AppCustomerModule.module.filter(isCustomVisible).map(customService),
    ...visibleBuiltins.value.map(builtinService)
  ]
})
const managedServices = computed(() => services.value.filter((service) => service.managed))
const groupRunning = computed(() => {
  const group = defaultGroup.value
  return group
    ? StartupGroupManager.isGroupRunning(group)
    : managedServices.value.some((service) => service.view.run)
})
const groupDisabled = computed(() => {
  if (!isDesktopReady() || active.value) return true
  if (
    isGroupVisible() &&
    (!startupGroupController.ready.value || startupGroupController.loading.value)
  )
    return true
  const group = defaultGroup.value
  return group
    ? group.empty || StartupGroupManager.busy || StartupGroupManager.isGroupExecuting(group)
    : !managedServices.value.some((service) => !service.view.disabled)
})

async function runExclusive(id: string, action: () => Promise<boolean>) {
  if (!isDesktopReady() || active.value || StartupGroupManager.runner.executing) return false
  active.value = id
  try {
    return await action()
  } catch (error) {
    showNotice(error instanceof Error ? error.message : String(error))
    return false
  } finally {
    active.value = undefined
  }
}

async function ensureGroups() {
  if (!isGroupVisible()) return
  if (!startupGroupController.ready.value || startupGroupController.loading.value) {
    await startupGroupController.init()
  }
  if (!startupGroupController.ready.value) {
    throw new Error(startupGroupController.error.value || 'Unable to load startup groups.')
  }
}

async function runServices(
  targets: Service[],
  action: Action,
  interactive: boolean,
  skipped: string[] = []
) {
  const outcomes = await Promise.allSettled(
    targets.map(async (service) => service.change(action, interactive))
  )
  const failures = outcomes.flatMap((outcome, index) => {
    if (outcome.status === 'fulfilled' && outcome.value === true) return []
    const reason =
      outcome.status === 'rejected'
        ? String(outcome.reason)
        : outcome.value || 'The service did not confirm the change.'
    return [`${targets[index].view.label}: ${reason}`]
  })
  if (skipped.length || failures.length) showNotice([...skipped, ...failures].join('\n'))
  else if (targets.length && interactive)
    showNotice(action === 'start' ? 'Services started.' : 'Services stopped.')
  return failures.length === 0 && skipped.length === 0
}

export function runTrayDefault(interactive = true) {
  return runExclusive('group', async () => {
    await ensureGroups()
    const group = defaultGroup.value
    if (group) {
      if (group.empty || StartupGroupManager.isGroupExecuting(group)) return false
      return startupGroupController.run(
        group,
        !interactive || !StartupGroupManager.isGroupRunning(group),
        interactive
      )
    }

    const builtins = visibleBuiltins.value.filter((module) => module.isService)
    const [custom, ...discovered] = await Promise.all([
      AppCustomerModule.init().then(
        () => true,
        () => false
      ),
      ...builtins.map((module) => discover(module.typeFlag))
    ])
    const unavailable = builtins.filter(
      (module, index) => !discovered[index] && isBuiltinModuleVisible(module.typeFlag)
    )
    const verified = new Set<string>(
      builtins.filter((_module, index) => discovered[index]).map((module) => module.typeFlag)
    )
    const skipped = unavailable.map(
      (module) => `${label(module)}: service availability could not be verified.`
    )
    if (!custom) skipped.push('Custom service definitions could not be loaded.')
    const eligible = managedServices.value.filter((service) =>
      service.custom ? custom : verified.has(service.view.typeFlag)
    )
    const anyRunning = eligible.some((service) => service.view.run)
    if (!interactive && anyRunning) return runServices([], 'start', false, skipped)
    const action = anyRunning ? 'stop' : 'start'
    const targets = eligible.filter(
      (service) => !service.view.disabled && service.view.run === (action === 'stop')
    )
    return runServices(targets, action, interactive, skipped)
  })
}

function runTrayGroup(id: string) {
  return runExclusive('group', async () => {
    if (!isGroupVisible()) return false
    await ensureGroups()
    const group = StartupGroupManager.store.find(id)
    if (!group || group.empty || StartupGroupManager.isGroupExecuting(group)) return false
    return startupGroupController.run(group, !StartupGroupManager.isGroupRunning(group))
  })
}

function switchService(id: string) {
  return runExclusive(id, async () => {
    const custom = AppCustomerModule.module.find(
      (module) => module.id === id && isCustomVisible(module)
    )
    const flag = id === 'php' && !custom ? 'php-fpm' : id
    const module = visibleBuiltins.value.find((candidate) => candidate.typeFlag === flag)
    if (!custom && (!module || !(await discover(module.typeFlag)))) return false
    const service = services.value.find(
      (candidate) => candidate.view.id === flag && Boolean(candidate.custom) === Boolean(custom)
    )
    if (!service || service.view.disabled) return false
    return runServices([service], service.view.run ? 'stop' : 'start', true)
  })
}

export function installTrayBridge() {
  if (installed) return
  installed = true
  IPC.on('APP:Tray-Command').then((_key: string, action: TrayAction, id?: unknown) => {
    if (action === 'groupDo') void runTrayDefault()
    else if (action === 'startupGroupDo' && typeof id === 'string') void runTrayGroup(id)
    else if (action === 'switchChange' && typeof id === 'string') void switchService(id)
  })

  const availableFlags = computed(() =>
    isDesktopReady() ? visibleBuiltins.value.map((module) => module.typeFlag) : []
  )
  watch(
    availableFlags,
    (flags, previous) => {
      for (const flag of flags) {
        if (!previous?.includes(flag)) void discover(flag)
      }
    },
    { immediate: true }
  )
  watch(
    () => isDesktopReady() && isGroupVisible(),
    (ready) => {
      if (ready && !startupGroupController.ready.value) void startupGroupController.init()
    },
    { immediate: true }
  )
  watch(groupRunning, (running) => IPC.send('Application:tray-status-change', running), {
    immediate: true
  })

  const app = AppStore()
  let revision = 0
  let lastSnapshot = ''
  watch(
    () => ({
      password: '',
      lang: app.config.setup.lang,
      theme: app.config.setup.theme ?? 'system',
      groupDisabled: groupDisabled.value,
      groupIsRunning: groupRunning.value,
      startupGroups: isGroupVisible()
        ? buildStartupGroupTrayItems(startupGroupController.groups.value, StartupGroupManager).map(
            (group) => ({ ...group, disabled: group.disabled || Boolean(active.value) })
          )
        : [],
      service: services.value.map(({ view }) => ({
        ...view,
        disabled: view.disabled || Boolean(active.value),
        running: view.running || active.value === view.id
      })),
      isWindows: window.Server.isWindows,
      isMacOS: window.Server.isMacOS,
      isLinux: window.Server.isLinux
    }),
    (snapshot) => {
      const current = ++revision
      void Promise.all(
        snapshot.service.map(async ({ icon, ...item }) => ({
          ...item,
          icon:
            typeof icon === 'string' ? icon : ((await icon?.catch(() => undefined))?.default ?? '')
        }))
      ).then((service) => {
        if (current !== revision) return
        const state: TrayState = { ...snapshot, service }
        const serialized = JSON.stringify(state)
        if (serialized === lastSnapshot) return
        lastSnapshot = serialized
        IPC.send('APP:Tray-Store-Sync', state)
      })
    },
    { immediate: true }
  )
}
