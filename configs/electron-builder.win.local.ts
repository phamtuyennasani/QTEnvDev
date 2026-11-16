import type { Configuration } from 'electron-builder'
import productionConfig from './electron-builder.win'

const config: Configuration = {
  ...productionConfig,
  directories: {
    ...productionConfig.directories,
    output: 'release'
  },
  artifactName: 'QTEnvDev-Local-Setup-${version}.${ext}',
  win: {
    ...productionConfig.win,
    signExecutable: false,
    target: {
      target: 'nsis',
      arch: ['x64']
    }
  },
  portable: {
    ...productionConfig.portable,
    artifactName: 'QTEnvDev-Local-Portable-${version}.${ext}'
  }
}

export default config
