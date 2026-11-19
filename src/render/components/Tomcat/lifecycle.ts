import { BrewStore } from '@/store/brew'
import { TomcatSetup } from './setup'

export function registerTomcatLifecycle() {
  BrewStore().module('tomcat').startExtParam ??= async (version) => [
    await TomcatSetup.resolve(version)
  ]
}
