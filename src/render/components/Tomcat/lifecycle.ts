import { BrewStore } from '@/store/brew'
import { TomcatSetup, tomcatCatalinaBase } from './setup'

export function registerTomcatLifecycle() {
  BrewStore().module('tomcat').startExtParam ??= async (version) => {
    await TomcatSetup.init()
    return [tomcatCatalinaBase(version)]
  }
}
