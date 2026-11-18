import localForage from 'localforage'
import { BrewStore } from '@/store/brew'
import { join } from '@/util/path-browserify'
import { RustfsSetup } from './setup'

export function registerRustfsLifecycle() {
  BrewStore().module('rustfs').startExtParam ??= async (version) => {
    const saved = await localForage.getItem<Record<string, string>>('qtenvdev-rustfs-storage-dir')
    if (saved) Object.assign(RustfsSetup.dir, saved)
    return [RustfsSetup.dir[version.bin] ?? join(window.Server.BaseDir!, 'rustfs/data')]
  }
}
