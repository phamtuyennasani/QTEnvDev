import { requestServiceFile, type ServiceFileInitializer } from '../state/serviceFilesController'

export function serviceConfigurationInitializer(flag?: string): ServiceFileInitializer | undefined {
  if (flag !== 'minio' && flag !== 'meilisearch' && flag !== 'rustfs') return undefined

  return async (file) => {
    const list = await requestServiceFile(flag, 'listConfigFiles', undefined)
    const reported = Array.isArray(list) && list.find((item) => item?.path === file.path && item?.name === file.name)
    if (!reported || typeof reported.exists !== 'boolean') {
      throw new Error('The service could not check the selected configuration file. Refresh before retrying.')
    }
    if (reported.exists) return 'exists'

    const result = await requestServiceFile(flag, 'initConfig', undefined)
    if (result !== file.path) {
      throw new Error('The service did not confirm the selected configuration file. Refresh before retrying.')
    }
    return 'created'
  }
}
