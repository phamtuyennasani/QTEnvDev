import { join } from '@/util/path-browserify'
import { createVersionDirectory } from '../ServiceManager/versionDirectory'

export const MeiliSearchSetup = createVersionDirectory(
  'qtenvdev-meilisearch-storage-dir',
  (base, version) => join(base, 'meilisearch', version.version.split('.').slice(0, 2).join('.'))
)
