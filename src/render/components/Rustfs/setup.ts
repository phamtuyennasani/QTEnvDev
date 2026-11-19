import { join } from '@/util/path-browserify'
import { createVersionDirectory } from '../ServiceManager/versionDirectory'

export const RustfsSetup = createVersionDirectory(
  'qtenvdev-rustfs-storage-dir',
  (base) => join(base, 'rustfs', 'data')
)
