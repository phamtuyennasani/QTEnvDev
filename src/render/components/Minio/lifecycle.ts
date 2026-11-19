import { BrewStore } from '@/store/brew'
import { MinioSetup } from './setup'

export function registerMinioLifecycle() {
  BrewStore().module('minio').startExtParam ??= async (version) => [
    await MinioSetup.resolve(version)
  ]
}
