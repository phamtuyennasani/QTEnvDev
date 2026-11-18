import type { AllAppModule } from '@/core/type'
import { BrewStore } from '@/store/brew'

const flags: Record<string, AllAppModule> = { PHP: 'php', 'Node.js': 'node', Python: 'python', Go: 'golang', Java: 'java', Ruby: 'ruby', Rust: 'rust', Bun: 'bun', Deno: 'deno', '.NET': 'dotnet', Erlang: 'erlang', Perl: 'perl', Zig: 'zig', Flutter: 'flutter', Gradle: 'gradle' }
export async function refreshRuntime(name: string): Promise<{ connected: boolean; installed: boolean; version?: string; path?: string }> {
  const flag = flags[name]
  if (!flag) return { connected: false, installed: false }
  try {
    const module = BrewStore().module(flag)
    if (!await module.fetchInstalled(false, { fresh: false })) throw new Error('Installed versions could not be refreshed.')
    const item = BrewStore().currentVersion(flag) ?? module.installed[0]
    return { connected: true, installed: Boolean(item), version: item?.version ?? undefined, path: item?.path ?? undefined }
  } catch { return { connected: false, installed: false } }
}
