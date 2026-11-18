import { reactiveBind } from '@/util/Index'
import { WebsiteController } from '../websites/WebsiteController'
import { websiteDependencies } from '../adapters/projectAdapter'

export const projectController = reactiveBind(new WebsiteController(websiteDependencies))
export type { ProjectItem } from '../websites/types'
