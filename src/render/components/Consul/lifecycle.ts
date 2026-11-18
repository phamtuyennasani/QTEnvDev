import localForage from 'localforage'
import { BrewStore } from '@/store/brew'
import { join } from '@/util/path-browserify'
import { ConsulSetup } from './setup'

export function registerConsulLifecycle() {
  BrewStore().module('consul').startExtParam ??= async (version) => {
    const saved = await localForage.getItem<Record<string, string>>('qtenvdev-consul-storage-dir')
    if (saved) Object.assign(ConsulSetup.dir, saved)
    return [ConsulSetup.dir[version.bin] ?? join(window.Server.BaseDir!, 'consul/consul-' + version.version.split('.')[0] + '-data')]
  }
}
