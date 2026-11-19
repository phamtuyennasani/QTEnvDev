import IPC from '@/util/IPC'
import { packageRequest } from './transport'
import type { PackageVersion } from './types'

export const sdkmanModules = ['java', 'maven', 'gradle'] as const
export type SdkmanFlag = (typeof sdkmanModules)[number]

export function supportsSdkman(
  flag: string,
  server: { isMacOS?: boolean; isLinux?: boolean }
): flag is SdkmanFlag {
  return Boolean((server.isMacOS || server.isLinux) && sdkmanModules.includes(flag as SdkmanFlag))
}

export const validSdkmanId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/.test(value)

export async function fetchSdkmanVersions(flag: SdkmanFlag): Promise<PackageVersion[]> {
  const result = await packageRequest(IPC, 'app-fork:sdkman', ['sdkmaninfo', flag])
  if (!Array.isArray(result)) throw new Error('SDKMAN returned an invalid package catalog.')
  const rows = new Map<string, PackageVersion>()
  for (const item of result) {
    if (!item || !validSdkmanId(item.version)) continue
    const identifier = item.identifier ?? (flag === 'java' ? undefined : item.version)
    if (!validSdkmanId(identifier)) continue
    rows.set(identifier, {
      typeFlag: flag,
      identifier,
      name: typeof item.name === 'string' ? item.name : identifier,
      version: item.version,
      channel: typeof item.vendor === 'string' ? item.vendor : undefined,
      installed: item.installed === true
    })
  }
  return [...rows.values()]
}
