import localForage from 'localforage'
import { BrewStore } from '@/store/brew'
import { join } from '@/util/path-browserify'
import { MinioSetup } from './setup'

export function registerMinioLifecycle() {
  BrewStore().module('minio').startExtParam ??= async (version) => {
    const saved = await localForage.getItem<Record<string, string>>('qtenvdev-minio-storage-dir')
    if (saved) Object.assign(MinioSetup.dir, saved)
    return [MinioSetup.dir[version.bin] ?? join(window.Server.BaseDir!, 'minio/data')]
  }
}
