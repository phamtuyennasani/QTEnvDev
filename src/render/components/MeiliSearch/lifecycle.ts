import localForage from 'localforage'
import { BrewStore } from '@/store/brew'
import { join } from '@/util/path-browserify'
import { MeiliSearchSetup } from './setup'

export function registerMeiliSearchLifecycle() {
  BrewStore().module('meilisearch').startExtParam ??= async (version) => {
    const saved = await localForage.getItem<Record<string, string>>('qtenvdev-meilisearch-storage-dir')
    if (saved) Object.assign(MeiliSearchSetup.dir, saved)
    return [MeiliSearchSetup.dir[version.bin] ?? join(window.Server.BaseDir!, 'meilisearch', version.version.split('.').slice(0, 2).join('.'))]
  }
}
