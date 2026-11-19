import { isHomebrewMirror, type HomebrewMirror } from '@shared/homebrewMirrors'
import { BrewStore } from '@/store/brew'
import { reactiveBind } from '@/util/Index'
import IPC from '@/util/IPC'
import { packageRequest } from '../packages/transport'
import { PackageOutcomeUnknown, packageError } from '../packages/types'
import { showNotice } from './app'

export class HomebrewMirrorController {
  loading = false
  unknown = false
  progress = ''
  error = ''

  get installed() {
    return Boolean(window.Server?.isMacOS && window.Server.BrewHome)
  }

  get current() {
    return BrewStore().brewSrc
  }

  get applying() {
    return BrewStore().brewRunning
  }

  async refresh() {
    if (!this.installed || this.loading || this.applying || this.unknown) return
    this.loading = true
    this.error = ''
    const store = BrewStore()
    store.brewSrc = ''
    try {
      const current = await packageRequest(IPC, 'app-fork:brew', ['currentSrc'], {
        timeout: 30_000
      })
      if (!isHomebrewMirror(current) && current !== 'custom')
        throw new Error('The Homebrew mirror could not be identified.')
      store.brewSrc = current
    } catch (error) {
      this.error = packageError(error)
    } finally {
      this.loading = false
    }
  }

  async apply(selection: HomebrewMirror) {
    if (
      !this.installed ||
      this.loading ||
      this.applying ||
      this.unknown ||
      !this.current ||
      !isHomebrewMirror(selection)
    )
      return false
    const store = BrewStore()
    store.brewRunning = true
    this.error = ''
    this.progress = 'Switching Homebrew mirror…'
    try {
      const result = await packageRequest(IPC, 'app-fork:brew', ['changeSrc', selection], {
        timeout: 120_000,
        mutation: true
      })
      if (result !== true)
        throw new PackageOutcomeUnknown('The backend did not confirm the Homebrew mirror change.')
      store.brewSrc = selection
    } catch (error) {
      this.unknown = error instanceof PackageOutcomeUnknown
      store.brewSrc = ''
      this.error = this.unknown
        ? 'The mirror change may still be running. Verify the Homebrew remote and profile changes before restarting the application.'
        : `The mirror change did not complete. Some settings may have changed. Refresh the Git origin before applying a mirror again. ${packageError(error)}`
      return false
    } finally {
      this.progress = ''
      store.brewRunning = false
    }
    showNotice('Homebrew mirror changed.')
    return true
  }
}

export const homebrewMirrorController = reactiveBind(new HomebrewMirrorController())
