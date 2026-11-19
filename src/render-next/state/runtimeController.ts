import { computed, reactive } from 'vue'
import { refreshRuntime, runtimeModuleFlags } from '../adapters/runtimeAdapter'
import { isBuiltinModuleVisible } from '../moduleVisibility/visibility'

export type RuntimeItem = { name: string; family: string; version: string; path: string; projects: number; state: 'active' | 'available' | 'update' }
const runtimes = reactive<RuntimeItem[]>([
  { name: 'PHP', family: 'Language runtime', version: '—', path: 'Not detected', projects: 0, state: 'available' },
  { name: 'Node.js', family: 'JavaScript runtime', version: '—', path: 'Not detected', projects: 0, state: 'available' },
  { name: 'Python', family: 'Language runtime', version: '—', path: 'Not detected', projects: 0, state: 'available' },
  { name: 'Go', family: 'Compiler toolchain', version: '—', path: 'Not detected', projects: 0, state: 'available' },
  { name: 'Java', family: 'JVM runtime', version: '—', path: 'Not detected', projects: 0, state: 'available' }, { name: 'Ruby', family: 'Language runtime', version: '—', path: 'Not detected', projects: 0, state: 'available' }, { name: 'Rust', family: 'Compiler toolchain', version: '—', path: 'Not detected', projects: 0, state: 'available' }, { name: 'Bun', family: 'JavaScript runtime', version: '—', path: 'Not detected', projects: 0, state: 'available' }, { name: 'Deno', family: 'JavaScript runtime', version: '—', path: 'Not detected', projects: 0, state: 'available' }, { name: '.NET', family: 'Runtime', version: '—', path: 'Not detected', projects: 0, state: 'available' }, { name: 'Erlang', family: 'Language runtime', version: '—', path: 'Not detected', projects: 0, state: 'available' }, { name: 'Perl', family: 'Language runtime', version: '—', path: 'Not detected', projects: 0, state: 'available' }, { name: 'Zig', family: 'Compiler toolchain', version: '—', path: 'Not detected', projects: 0, state: 'available' }, { name: 'Flutter', family: 'SDK runtime', version: '—', path: 'Not detected', projects: 0, state: 'available' }, { name: 'Gradle', family: 'Build toolchain', version: '—', path: 'Not detected', projects: 0, state: 'available' }
])
const selected = reactive<{ runtime?: RuntimeItem }>({ runtime: runtimes[0] })
const visibleRuntimes = computed(() => runtimes.filter((runtime) => isBuiltinModuleVisible(runtimeModuleFlags[runtime.name])))
const refresh = async () => {
  await Promise.all(visibleRuntimes.value.map(async (runtime) => {
    const result = await refreshRuntime(runtime.name)
    if (!result.connected) return
    runtime.state = result.installed ? 'active' : 'available'
    runtime.version = result.version || '—'
    runtime.path = result.path || 'Not detected'
  }))
}
export const runtimeController = { runtimes, visibleRuntimes, selected, activeCount: computed(() => visibleRuntimes.value.filter((item) => item.state === 'active').length), select(runtime: RuntimeItem) { selected.runtime = runtime }, refresh }
