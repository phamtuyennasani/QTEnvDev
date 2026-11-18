import { BrewStore } from '@/store/brew'
import { join } from '@/util/path-browserify'
import { PostgreSqlSetup } from './setup'

export function registerPostgreSqlLifecycle() {
  const module = BrewStore().module('postgresql')
  const parameters = async (version: { version: string; bin: string }) => {
    await PostgreSqlSetup.init()
    return [PostgreSqlSetup.dir[version.bin] ?? join(window.Server.PostgreSqlDir!, 'postgresql' + version.version.split('.')[0])]
  }
  module.startExtParam ??= parameters
  module.stopExtParam ??= parameters
}
