import { BrewStore } from '@/store/brew'
import { RustfsSetup } from './setup'

export function registerRustfsLifecycle() {
  BrewStore().module('rustfs').startExtParam ??= async (version) => [
    await RustfsSetup.resolve(version)
  ]
}
