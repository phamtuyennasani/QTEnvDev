import { BrewStore } from '@/store/brew'
import { join } from '@/util/path-browserify'
import { PostgreSqlSetup } from './setup'

export async function postgreSqlDataDirectory(version: { version: string; bin: string }) {
  await PostgreSqlSetup.init()
  return PostgreSqlSetup.dir[version.bin] ??
    join(window.Server.PostgreSqlDir!, 'postgresql' + version.version.split('.')[0])
}

export function registerPostgreSqlLifecycle() {
  const module = BrewStore().module('postgresql')
  const parameters = async (version: { version: string; bin: string }) => [await postgreSqlDataDirectory(version)]
  module.startExtParam ??= parameters
  module.stopExtParam ??= parameters
}
