import { reactive } from 'vue'
import { shell } from '@/util/NodeFn'
import { homebrewUpgrade } from '@/components/VersionManager/brew/Controller'
import { PodmanManager } from '@/components/Podman/class/Podman'
import { showNotice } from '../state/app'

export const podmanInstallation = reactive({
  running: false,
  outcome: '' as '' | 'succeeded' | 'failed' | 'unknown',
  message: '',
  logs: ''
})

export async function installPodman() {
  if (
    !window.Server.isMacOS ||
    !window.Server.BrewBin ||
    homebrewUpgrade.busy ||
    podmanInstallation.running ||
    podmanInstallation.outcome === 'unknown'
  )
    return
  podmanInstallation.running = true
  podmanInstallation.message = ''
  podmanInstallation.logs = ''
  try {
    const result = await homebrewUpgrade.package({
      name: 'podman',
      installed: false,
      typeFlag: 'podman'
    })
    podmanInstallation.logs = result.logs
    podmanInstallation.outcome = result.outcome
    if (result.outcome === 'succeeded') {
      podmanInstallation.message = 'Homebrew installed Podman.'
      PodmanManager.reinit()
    } else {
      podmanInstallation.message =
        result.error || 'Homebrew did not confirm the Podman installation.'
    }
  } catch (error) {
    podmanInstallation.outcome = 'failed'
    podmanInstallation.message = String(error)
  } finally {
    podmanInstallation.running = false
  }
}

export async function openPodmanGuide() {
  try {
    await shell.openExternal('https://podman.io/docs/installation')
  } catch (error) {
    showNotice(String(error))
  }
}
