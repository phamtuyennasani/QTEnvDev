import { reactiveBind } from '@/util/Index'
import { dialog, fs } from '@/util/NodeFn'
import { packageError } from '../packages/types'
import { showNotice } from '../state/app'
import { requestServiceFile } from '../state/serviceFilesController'

class PhpCommonConfigurationController {
  picking = false
  private preparingCertificate = false

  async chooseFile(
    name: string,
    currentPath: string,
    isCurrent: () => boolean,
    apply: (path: string) => void
  ) {
    if (this.picking) return
    this.picking = true
    try {
      const result = await dialog.showOpenDialog({
        title: 'Choose file for ' + name,
        defaultPath: currentPath || undefined,
        properties: ['openFile', 'showHiddenFiles']
      })
      const path = result.filePaths[0]
      if (!result.canceled && path && isCurrent()) apply(path)
    } catch (error) {
      if (isCurrent()) showNotice(packageError(error))
    } finally {
      this.picking = false
    }
  }

  async prepareCertificate(path: string) {
    if (!path || this.preparingCertificate) return
    this.preparingCertificate = true
    try {
      if (await fs.existsSync(path)) return
      await requestServiceFile('php', 'initCACertPEM', undefined)
      if (!(await fs.existsSync(path)))
        showNotice('The bundled PHP CA certificate could not be prepared.')
    } catch (error) {
      showNotice('Could not prepare the bundled PHP CA certificate. ' + packageError(error))
    } finally {
      this.preparingCertificate = false
    }
  }
}

export const phpCommonConfigurationController = reactiveBind(new PhpCommonConfigurationController())
