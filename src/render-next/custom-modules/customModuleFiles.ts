import { reactive } from 'vue'
import { ServiceFilesController, type ServiceFile } from '../state/serviceFilesController'

export type CustomModuleFileView = {
  title: string
  kind: ServiceFile['kind']
  provider: () => Promise<ServiceFile[]>
}

export const customFilesController = reactive(new ServiceFilesController())
