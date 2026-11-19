import type { SoftInstalled } from '@shared/app'
import { BrewStore } from '@/store/brew'
import {
  requestServiceFile,
  type ServiceFileInitializer
} from '../state/serviceFilesController'

export function databaseConfigurationInitializer(
  flag: 'clickhouse' | 'neo4j',
  version: SoftInstalled
): ServiceFileInitializer {
  const target = JSON.parse(JSON.stringify(version)) as SoftInstalled
  return async (file) => {
    const installed = BrewStore().module(flag).installed
    if (!installed.some((item) => item.bin === target.bin && item.version === target.version)) {
      throw new Error('This installation changed. Reopen the configuration editor.')
    }
    const list = await requestServiceFile(flag, 'listConfigFiles', target)
    const files = Array.isArray(list) ? list : []
    const reported = files.find((item) => item?.path === file.path && item?.name === file.name)
    if (!reported) throw new Error('The database does not list this configuration file.')
    if (reported.exists === true) return 'exists'
    if (reported.exists !== false) throw new Error('Could not check whether the configuration exists.')

    const result = await requestServiceFile(flag, 'initConfig', target)
    const main = flag === 'neo4j' ? file.path : files.find((item) => item?.name === 'config')?.path
    if (!main || result !== main) {
      throw new Error('Could not verify initialization. Refresh the configuration before retrying.')
    }
    return 'created'
  }
}
