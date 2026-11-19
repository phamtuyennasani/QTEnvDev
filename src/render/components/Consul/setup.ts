import { join } from '@/util/path-browserify'
import { createVersionDirectory } from '../ServiceManager/versionDirectory'

export const ConsulSetup = createVersionDirectory(
  'qtenvdev-consul-storage-dir',
  (base, version) => join(base, 'consul', `consul-${version.version.split('.')[0]}-data`)
)
