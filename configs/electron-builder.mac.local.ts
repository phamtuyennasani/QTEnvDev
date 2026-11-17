import type { Configuration } from 'electron-builder'
import productionConfig from './electron-builder'
import AfterPack from '../build/afterPack'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'

const execFileAsync = promisify(execFile)

const config: Configuration = {
  ...productionConfig,
  artifactName: 'QTEnvDev-Local-${version}.${ext}',
  mac: {
    ...productionConfig.mac,
    identity: '-',
    // The helper is signed below with its own identifier; do not re-sign it as
    // an Electron child binary with an automatically generated identifier.
    signIgnore: ['/Contents/Resources/helper/qtenvdev-helper$'],
    preAutoEntitlements: false,
    strictVerify: true,
    notarize: false,
    extendInfo: {
      ...productionConfig.mac?.extendInfo,
      QTEnvDevInternalBuild: true
    },
    target: [{ target: 'dmg', arch: ['arm64'] }]
  },
  dmg: {
    ...productionConfig.dmg,
    sign: false
  },
  afterPack: async (pack) => {
    await AfterPack(pack)
    // Give the Go helper a stable identifier before the complete app is sealed.
    await execFileAsync('/usr/bin/codesign', [
      '--force',
      '--sign',
      '-',
      '--identifier',
      'qtenvdev-helper',
      '--timestamp=none',
      join(pack.appOutDir, 'QTEnvDev.app/Contents/Resources/helper/qtenvdev-helper')
    ])
  },
  afterSign: async (pack) => {
    const app = join(pack.appOutDir, 'QTEnvDev.app')
    await execFileAsync('/usr/bin/codesign', [
      '--verify',
      '--deep',
      '--strict',
      '--all-architectures',
      '-R',
      '=identifier "phpstudy.xpfme.com"',
      app
    ])
    await execFileAsync('/usr/bin/codesign', [
      '--verify',
      '--strict',
      '--all-architectures',
      '-R',
      '=identifier "qtenvdev-helper"',
      join(app, 'Contents/Resources/helper/qtenvdev-helper')
    ])
  },
  publish: []
}

export default config
