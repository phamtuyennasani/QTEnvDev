import { ConsulSetup } from '@/components/Consul/setup'
import { MeiliSearchSetup } from '@/components/MeiliSearch/setup'
import { MinioSetup } from '@/components/Minio/setup'
import { RustfsSetup } from '@/components/Rustfs/setup'
import { TomcatSetup } from '@/components/Tomcat/setup'
import { BrewStore } from '@/store/brew'
import { reactiveBind } from '@/util/Index'
import { dialog, shell } from '@/util/NodeFn'
import { showNotice } from '../state/app'

const directories = {
  consul: ConsulSetup,
  meilisearch: MeiliSearchSetup,
  minio: MinioSetup,
  rustfs: RustfsSetup,
  tomcat: TomcatSetup
}

export type ServiceDirectoryFlag = keyof typeof directories

export function isServiceDirectoryFlag(flag: string): flag is ServiceDirectoryFlag {
  return Object.hasOwn(directories, flag)
}

class ServiceDirectoryController {
  private operations = new Set<ServiceDirectoryFlag>()

  private version(flag: ServiceDirectoryFlag) {
    const store = BrewStore()
    const { installed } = store.module(flag)
    return installed.find((item) => item.run) ?? store.currentVersion(flag) ?? installed[0]
  }

  path(flag: ServiceDirectoryFlag) {
    const version = this.version(flag)
    const directory = directories[flag]
    return directory.state.loaded && version?.bin ? directory.path(version) : ''
  }

  editable(flag: ServiceDirectoryFlag) {
    const { starting, installed } = BrewStore().module(flag)
    return Boolean(this.path(flag)) && !starting && !installed.some(({ run, running }) => run || running)
  }

  busy(flag: ServiceDirectoryFlag) {
    return this.operations.has(flag)
  }

  async load(flag: ServiceDirectoryFlag) {
    try {
      await directories[flag].load()
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error))
    }
  }

  async choose(flag: ServiceDirectoryFlag) {
    const version = this.version(flag)
    const defaultPath = this.path(flag)
    if (!version || !this.editable(flag)) return
    const { bin } = version
    return this.run(flag, async () => {
      const result = await dialog.showOpenDialog({
        title: 'Choose service directory',
        defaultPath,
        properties: ['openDirectory', 'createDirectory', 'showHiddenFiles']
      })
      const path = result.filePaths[0]
      if (result.canceled || !path || path === defaultPath) return
      const admit = () => this.editable(flag) && this.version(flag)?.bin === bin
      await directories[flag].setDirectory(bin, path, admit)
      showNotice('Service directory saved for the next start.')
    })
  }

  async open(flag: ServiceDirectoryFlag) {
    const path = this.path(flag)
    if (!path) return
    return this.run(flag, async () => {
      const error = await shell.openPath(path)
      if (error) throw new Error(error)
    })
  }

  private async run(flag: ServiceDirectoryFlag, action: () => Promise<void>) {
    if (this.busy(flag)) return
    this.operations.add(flag)
    try {
      await action()
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error))
    } finally {
      this.operations.delete(flag)
    }
  }
}

export const serviceDirectoryController = reactiveBind(new ServiceDirectoryController())
