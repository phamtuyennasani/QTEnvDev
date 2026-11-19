import { reactive } from 'vue'
import { BrewStore } from '@/store/brew'
import { fs, shell } from '@/util/NodeFn'
import { join } from '@/util/path-browserify'
import { showNotice } from '../state/app'
import { dashboardPolicy, dashboardUrl } from './endpoints'

export function serviceDashboardLabel(flag?: string) {
  return dashboardPolicy(flag)?.label
}

async function readConfig(relativePath: string) {
  const base = window.Server?.BaseDir
  if (!base) throw new Error('The service directory is unavailable.')
  try {
    return await fs.readFileStrict(join(base, relativePath))
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return ''
    throw error
  }
}

const opening = reactive(new Set<string>())

export const serviceDashboardController = {
  isOpening(flag?: string) {
    return Boolean(flag && opening.has(flag))
  },

  async open(flag?: string) {
    const policy = dashboardPolicy(flag)
    if (!flag || !policy || opening.has(flag)) return false
    opening.add(flag)
    try {
      const module = BrewStore().module(flag)
      const running = module.installed.find((entry) => entry.run && entry.bin && entry.version)
      if (!running?.version) {
        showNotice('Start the service before opening its dashboard.')
        return false
      }
      const { bin, version } = running
      const path = typeof policy.file === 'function' ? policy.file(version) : policy.file
      const contents = path ? await readConfig(path) : ''
      const url = dashboardUrl(policy, contents)

      if (
        !module.installed.some(
          (entry) => entry.run && entry.bin === bin && entry.version === version
        )
      ) {
        showNotice('The running service changed. Try opening its dashboard again.')
        return false
      }
      const result = await shell.openExternalChecked(url)
      if (result.code !== 0) {
        showNotice('The browser could not open the service dashboard.')
        return false
      }
      return true
    } catch {
      showNotice('Could not open the service dashboard. Check its endpoint settings and try again.')
      return false
    } finally {
      opening.delete(flag)
    }
  }
}
