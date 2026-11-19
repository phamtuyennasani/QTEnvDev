import { BrewStore } from '@/store/brew'
import { ConsulSetup } from './setup'

export function registerConsulLifecycle() {
  BrewStore().module('consul').startExtParam ??= async (version) => [
    await ConsulSetup.resolve(version)
  ]
}
