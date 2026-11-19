import { join } from '@/util/path-browserify'
import { createVersionDirectory } from '../ServiceManager/versionDirectory'

export const TomcatSetup = createVersionDirectory(
  'qtenvdev-tomcat-server-root',
  (base, version) => join(base, 'tomcat', `tomcat${version.version.split('.')[0]}`)
)

export const tomcatCatalinaBase = TomcatSetup.path
