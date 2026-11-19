import { join } from '@/util/path-browserify'
import { createVersionDirectory } from '../ServiceManager/versionDirectory'

export const MinioSetup = createVersionDirectory(
  'qtenvdev-minio-storage-dir',
  (base) => join(base, 'minio', 'data')
)
