import { reactiveBind } from '@/util/Index'
import { BrewStore } from '@/store/brew'
import { versionDelete } from '@/util/NodeFn'
import { setInstalledVersionNote } from '@/util/InstalledVersionNote'
import { VersionDeleteOperation } from '@/components/ServiceManager/VersionDeleteOperation'
import { PackageController } from '../packages/PackageController'
import { fetchPackageVersions, installPackage, inspectPackage, readInstalledPackages } from '../adapters/packageAdapter'
import { showNotice } from './app'

const deleteOperation = new VersionDeleteOperation({
  inspect: versionDelete.inspect,
  remove: versionDelete.remove,
  async stop(target) {
    const module = BrewStore().module(target.typeFlag)
    if (!await module.fetchInstalled(false, { fresh: true })) throw new Error('The installed version could not be verified before stopping it.')
    const item = module.installed.find((item) => item.bin.replace(/\\/g, '/').toLowerCase() === target.bin.replace(/\\/g, '/').toLowerCase())
    if (!item) throw new Error('The installed version was not found. Refresh the package list before removing it.')
    return item.stop()
  },
  committed(target) {
    const module = BrewStore().module(target.typeFlag)
    module.installed = module.installed.filter((item) => item.bin !== target.bin)
    module.installedFetched = false
  },
  async refresh(target) {
    await setInstalledVersionNote({ ...target, num: null, enable: true, run: false, running: false }, '', target.typeFlag)
  },
  error: showNotice,
  refreshError: (error) => showNotice('Version removed. Metadata refresh failed: ' + String(error))
})

export const packageController = reactiveBind(new PackageController({
  ready: () => Boolean(window.Server?.DataDirectoryReady && window.QTEnvDevNodeAPI),
  list: fetchPackageVersions,
  installed: readInstalledPackages,
  install: installPackage,
  inspect: inspectPackage,
  remove: (item, directory, confirmation) => deleteOperation.remove({ typeFlag: item.typeFlag, version: item.version, path: directory.path, bin: directory.bin }, directory, confirmation, () => {}),
  notice: showNotice,
  changed: () => window.dispatchEvent(new CustomEvent('pqt-packages-changed'))
}))
