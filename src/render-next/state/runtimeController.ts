import { computed, reactive } from 'vue'
import { ServiceActionStore } from '@/components/ServiceManager/EXT/store'
import { installedRuntime, refreshRuntime, runtimeModuleFlags } from '../adapters/runtimeAdapter'
import { isBuiltinModuleVisible } from '../moduleVisibility/visibility'
import { isWorkflowKind, projectWorkflowController } from './projectWorkflowController'

const runtimeCatalog = [
  { name: 'PHP', family: 'Language runtime' },
  { name: 'Node.js', family: 'JavaScript runtime' },
  { name: 'Python', family: 'Language runtime' },
  { name: 'Go', family: 'Compiler toolchain' },
  { name: 'Java', family: 'JVM runtime' },
  { name: 'Ruby', family: 'Language runtime' },
  { name: 'Rust', family: 'Compiler toolchain' },
  { name: 'Bun', family: 'JavaScript runtime' },
  { name: 'Deno', family: 'JavaScript runtime' },
  { name: '.NET', family: 'Runtime' },
  { name: 'Erlang', family: 'Language runtime' },
  { name: 'Perl', family: 'Language runtime' },
  { name: 'Zig', family: 'Compiler toolchain' },
  { name: 'Flutter', family: 'SDK runtime' },
  { name: 'Swoole CLI', family: 'PHP runtime' },
  { name: 'RoadRunner', family: 'PHP application server' },
  { name: 'Gradle', family: 'Build toolchain' }
]

const selected = reactive({ name: runtimeCatalog[0].name })
const visibleCatalog = computed(() =>
  runtimeCatalog.filter(({ name }) => isBuiltinModuleVisible(runtimeModuleFlags[name]))
)
const visibleRuntimes = computed(() =>
  visibleCatalog.value.map((runtime) => {
    const flag = runtimeModuleFlags[runtime.name]
    const item = installedRuntime(flag)
    return {
      ...runtime,
      version: item?.version || '—',
      path: item?.path || 'Not detected',
      projects: isWorkflowKind(flag) ? projectWorkflowController.count(flag) : undefined,
      state: item ? 'active' : 'available'
    }
  })
)

const refresh = async () => {
  await Promise.allSettled([
    ...visibleCatalog.value.map(({ name }) => refreshRuntime(runtimeModuleFlags[name])),
    ServiceActionStore.fetchPath()
  ])
}

export const runtimeController = {
  visibleRuntimes,
  selected,
  select(name: string) {
    selected.name = name
  },
  refresh
}
