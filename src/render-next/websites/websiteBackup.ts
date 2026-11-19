import { ensureDataDirectoryReady } from '@/core/DataDirectoryStartup'
import { reactiveBind } from '@/util/Index'
import IPC from '@/util/IPC'
import { dialog } from '@/util/NodeFn'
import { showNotice } from '../state/app'
import { projectController } from '../state/projectController'
import { WebsiteBackupController } from './WebsiteBackupController'
import { WebsiteOutcomeUnknown } from './types'

type Progress = (message: string, waiting?: boolean) => void
type Method = 'websiteBackupExport' | 'websiteBackupPreview' | 'websiteBackupImport'
const filters = [{ name: 'Website backup', extensions: ['json'] }]

async function request(method: Method, args: string[], progress?: Progress): Promise<any> {
  if (!(await ensureDataDirectoryReady()))
    throw new Error('The application data directory is not ready.')
  return new Promise((resolve, reject) => {
    const sent = IPC.sendSensitive('app-fork:host', method, ...args)
    let observing = false
    const timer = setTimeout(() => {
      if (progress) {
        observing = true
        progress('The result is still unknown. Waiting for the desktop process to reply…', true)
      } else {
        IPC.off(sent.key)
        reject(new Error('Reading the website backup timed out.'))
      }
    }, 60_000)
    sent.then((key, reply) => {
      if (reply?.code === 200) {
        if (!observing)
          progress?.(typeof reply.msg === 'string' ? reply.msg : 'Importing websites…')
        return
      }
      clearTimeout(timer)
      IPC.off(key)
      if (reply?.code === 0) resolve(reply.data)
      else if (reply?.code === 1 && reply.errorCode === 'WEBSITE_WRITE_OUTCOME_UNKNOWN')
        reject(new WebsiteOutcomeUnknown(reply.msg))
      else if (reply?.code === 1)
        reject(
          new Error(typeof reply.msg === 'string' ? reply.msg : 'Website backup operation failed.')
        )
      else if (method === 'websiteBackupImport')
        reject(new WebsiteOutcomeUnknown('The website import result could not be verified.'))
      else reject(new Error('The website backup operation returned an invalid result.'))
    })
  })
}

export const websiteBackup = reactiveBind(
  new WebsiteBackupController({
    async choose(action) {
      if (action === 'export') {
        const result = await dialog.showSaveDialog({
          filters,
          defaultPath: 'website-backup.json',
          properties: ['createDirectory', 'showOverwriteConfirmation']
        })
        return result.canceled ? undefined : result.filePath
      }
      const result = await dialog.showOpenDialog({
        filters,
        properties: ['openFile', 'showHiddenFiles']
      })
      return result.canceled ? undefined : result.filePaths[0]
    },
    async exportFile(file, progress) {
      progress('Exporting websites…')
      const result = await request('websiteBackupExport', [file], progress)
      if (!Number.isSafeInteger(result?.count) || !Array.isArray(result?.warnings))
        throw new Error('The export result could not be verified.')
      return result
    },
    async previewFile(file) {
      const result = await request('websiteBackupPreview', [file])
      if (
        typeof result?.token !== 'string' ||
        !Array.isArray(result?.sites) ||
        !Array.isArray(result?.warnings)
      ) {
        throw new Error('The backup preview could not be verified.')
      }
      return result
    },
    async importFile(file, token, progress) {
      progress('Importing websites…')
      const result = await request('websiteBackupImport', [file, token], progress)
      if (result?.outcome === 'unknown' && typeof result.message === 'string') return result
      if (
        result?.outcome !== 'committed' ||
        !Array.isArray(result.host) ||
        !Number.isSafeInteger(result.count) ||
        !Array.isArray(result.warnings)
      ) {
        throw new WebsiteOutcomeUnknown('The website import result could not be verified.')
      }
      return result
    },
    exclusive: (operation) => projectController.runExclusive(operation),
    reconcile: (hosts) => projectController.applyBackupHosts(hosts),
    afterImport: () => projectController.afterBackupImport(),
    notice: showNotice
  })
)
