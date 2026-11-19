import type { AllAppModule } from '@/core/type'
import { AppStore } from '@/store/app'
import { BrewStore } from '@/store/brew'
import { ServiceActionStore } from '@/components/ServiceManager/EXT/store'

export const runtimeModuleFlags: Record<string, AllAppModule> = {
  PHP: 'php',
  'Node.js': 'node',
  Python: 'python',
  Go: 'golang',
  Java: 'java',
  Ruby: 'ruby',
  Rust: 'rust',
  Bun: 'bun',
  Deno: 'deno',
  '.NET': 'dotnet',
  Erlang: 'erlang',
  Perl: 'perl',
  Zig: 'zig',
  Flutter: 'flutter',
  'Swoole CLI': 'swoole-cli',
  RoadRunner: 'roadrunner',
  Gradle: 'gradle'
}

export async function refreshRuntime(flag: AllAppModule) {
  const store = BrewStore()
  if (await store.module(flag).fetchInstalled()) store.currentVersion(flag)
}

export function installedRuntime(flag: AllAppModule) {
  const installed = BrewStore().modules[flag]?.installed ?? []
  const current = AppStore().config.server?.[flag]?.current
  const pathVersion = flag === 'php' ? undefined : installed.find(ServiceActionStore.isInAppEnv)
  return (
    pathVersion ??
    installed.find((item) => item.path === current?.path && item.version === current?.version) ??
    installed[0]
  )
}
