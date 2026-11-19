import { reactive } from 'vue'
import { localCertificatePath, localCertificateTrustCommand } from './localCertificate'
import { clipboard, fs, shell } from '@/util/NodeFn'
import { showNotice } from '../state/app'
import { websiteError } from './types'

const state = reactive({ busy: false })

async function act(action: 'copy' | 'reveal') {
  if (state.busy) return
  state.busy = true
  try {
    const server = window.Server
    if (!server?.BaseDir) throw new Error('The application data directory is not ready.')
    const path = localCertificatePath(server.BaseDir)
    const platform = server.isWindows ? 'windows' : server.isMacOS ? 'macos' : 'linux'
    if ((await fs.existsSync(path)) !== true) {
      throw new Error(
        'The local CA certificate is unavailable. Save a website with an automatic certificate to generate it.'
      )
    }
    if (action === 'copy') {
      await clipboard.writeText(localCertificateTrustCommand(path, platform))
      showNotice(
        platform === 'windows' ? 'PowerShell trust command copied.' : 'Trust command copied.'
      )
    } else {
      await shell.showItemInFolder(path)
    }
  } catch (error) {
    showNotice(websiteError(error))
  } finally {
    state.busy = false
  }
}

export const localCertificateController = { state, act }
