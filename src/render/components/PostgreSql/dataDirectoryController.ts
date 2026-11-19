import { BrewStore } from '@/store/brew'
import { reactiveBind } from '@/util/Index'
import { dialog, shell } from '@/util/NodeFn'
import { postgreSqlDataDirectoryPath } from './lifecycle'
import { PostgreSqlSetup } from './setup'

class PostgreSqlDataDirectoryController {
  busy = false
  loaded = false
  error = ''

  supported() {
    return Boolean(window.Server?.DataDirectoryReady && window.Server.PostgreSqlDir)
  }

  private version() {
    if (!this.supported()) return undefined
    const store = BrewStore()
    const module = store.module('postgresql')
    return module.installed.find((item) => item.run) ?? store.currentVersion('postgresql')
  }

  get editable() {
    if (!this.loaded || !this.version()?.bin) return false
    const module = BrewStore().module('postgresql')
    return !module.starting && !module.installed.some((item) => item.run || item.running)
  }

  get path() {
    if (!this.loaded) return ''
    const version = this.version()
    return version?.bin ? postgreSqlDataDirectoryPath(version) : ''
  }

  async load() {
    if (!this.supported() || this.loaded || this.busy) return
    await this.run(async () => {
      await PostgreSqlSetup.init()
      this.loaded = true
    })
  }

  async choose() {
    const version = this.version()
    if (!this.editable || !version) return
    const { bin } = version
    const defaultPath = this.path
    await this.run(async () => {
      const result = await dialog.showOpenDialog({
        defaultPath,
        properties: ['openDirectory', 'createDirectory', 'showHiddenFiles']
      })
      const path = result.filePaths[0]
      if (result.canceled || !path) return
      if (!this.editable || this.version()?.bin !== bin)
        throw new Error(
          'The PostgreSQL version or service state changed. Choose the directory again.'
        )
      await PostgreSqlSetup.setDirectory(bin, path)
    })
  }

  async open() {
    const path = this.path
    if (!path) return
    await this.run(async () => {
      const message = await shell.openPath(path)
      if (message) throw new Error(message)
    })
  }

  private async run(action: () => Promise<void>) {
    if (this.busy) return
    this.busy = true
    this.error = ''
    try {
      await action()
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
    } finally {
      this.busy = false
    }
  }
}

export const postgreSqlDataDirectoryController = reactiveBind(
  new PostgreSqlDataDirectoryController()
)
