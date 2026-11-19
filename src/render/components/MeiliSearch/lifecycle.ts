import { BrewStore } from '@/store/brew'
import { MeiliSearchSetup } from './setup'

export function registerMeiliSearchLifecycle() {
  BrewStore().module('meilisearch').startExtParam ??= async (version) => [
    await MeiliSearchSetup.resolve(version)
  ]
}
