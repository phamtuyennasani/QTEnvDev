import { BrewStore } from '@/store/brew'
import { ensureDataDirectoryReady } from '@/core/DataDirectoryStartup'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'
import { reactiveBind } from '@/util/Index'
import { clipboard, dialog, ip, shell } from '@/util/NodeFn'
import type { FtpItem } from '@shared/app'
import { FtpAccountsController, FtpMutationUnknown, type FtpMode } from './Controller'
import type { ServiceFile } from '../state/serviceFilesController'

const builtinVersion = { version: '1.0', typeFlag: 'ftp-srv' }
const pureVersion = () => {
  const store = BrewStore()
  const module = store.module('pure-ftpd')
  return (
    module.installed.find((item) => item.run) ??
    store.currentVersion('pure-ftpd') ??
    module.installed[0]
  )
}
async function ftpRequest(
  mode: FtpMode,
  method: string,
  args: unknown[] = [],
  sensitive = false,
  mutation = false
) {
  if (!(await ensureDataDirectoryReady())) throw new Error('Application data is unavailable.')
  let reply
  try {
    reply = await forkTerminalRequest(
      'app-fork:' + mode,
      [method, ...args],
      'FTP did not return a result.',
      mutation ? 360_000 : 60_000,
      undefined,
      sensitive
    )
  } catch (error) {
    if (mutation)
      throw new FtpMutationUnknown('The result is unknown. Refresh FTP before trying again.')
    throw error
  }
  if (reply.outcome === 'unknown' && mutation)
    throw new FtpMutationUnknown(
      'The FTP operation could not be verified. Refresh before trying again.'
    )
  if (reply.code !== 0) throw new Error(reply.msg || 'FTP operation failed.')
  return reply.data
}

export const ftpAccounts = Object.fromEntries(
  (['ftp-srv', 'pure-ftpd'] as const).map((mode) => {
    const builtin = mode === 'ftp-srv'
    return [
      mode,
      reactiveBind(
        new FtpAccountsController({
          async status() {
            if (builtin) {
              const status = await ftpRequest(mode, 'workspaceStatus')
              if (typeof status?.running !== 'boolean')
                throw new Error('FTP status could not be verified.')
              return { installed: true, running: status.running, port: status.port }
            }
            if (!(await BrewStore().module('pure-ftpd').fetchInstalled(false, { fresh: false }))) {
              throw new Error('Could not load installed Pure-FTPd versions.')
            }
            const port = Number(await ftpRequest(mode, 'getPort'))
            const version = pureVersion()
            return {
              installed: Boolean(version),
              running: Boolean(version?.run),
              port: Number.isInteger(port) && port > 0 ? port : undefined
            }
          },
          async accounts() {
            const items = await ftpRequest(mode, 'getAllFtp', [], true)
            if (!Array.isArray(items)) throw new Error('FTP did not report its accounts.')
            return items.filter(
              (item): item is FtpItem =>
                typeof item?.user === 'string' &&
                typeof item?.dir === 'string' &&
                typeof item?.pass === 'string'
            )
          },
          async change(action) {
            if (builtin) {
              if (action !== 'start')
                await ftpRequest(mode, 'stopService', [builtinVersion], false, true)
              if (action !== 'stop')
                await ftpRequest(mode, 'startService', [builtinVersion], false, true)
              return
            }
            const version = pureVersion()
            if (!version) throw new Error('Install a Pure-FTPd version first.')
            const result = await version[action]()
            if (result !== true)
              throw new Error(
                typeof result === 'string' ? result : 'Pure-FTPd did not confirm the change.'
              )
          },
          async write(action, item) {
            const version = builtin ? undefined : pureVersion()
            if (!builtin && !version) throw new Error('Install a Pure-FTPd version first.')
            const result = await ftpRequest(
              mode,
              action === 'add' ? 'addFtp' : 'delFtp',
              builtin ? [item, true] : [item, JSON.parse(JSON.stringify(version)), true],
              true,
              true
            )
            if (result === true) return undefined
            if (typeof result?.warning === 'string') return result.warning
            throw new FtpMutationUnknown(
              'FTP did not confirm the saved account. Refresh before trying again.'
            )
          },
          async folder(path) {
            const result = await dialog.showOpenDialog({
              defaultPath: path,
              properties: ['openDirectory', 'createDirectory']
            })
            return result.canceled ? undefined : result.filePaths[0]
          },
          open: async (path) => {
            await shell.openPath(path)
          },
          copy: async (text) => {
            await clipboard.writeText(text)
          },
          addresses: ip.addressList
        })
      )
    ]
  })
) as Record<FtpMode, FtpAccountsController>

export const pureFtpSupported = () => Boolean(window.Server && !window.Server.isWindows)

export async function pureConfigFiles(): Promise<ServiceFile[]> {
  await ftpRequest('pure-ftpd', 'initConf')
  const files = await ftpRequest('pure-ftpd', 'listConfigFiles', [undefined])
  if (!Array.isArray(files)) throw new Error('Pure-FTPd did not report its configuration files.')
  return files
    .filter((file) => typeof file?.name === 'string' && typeof file?.path === 'string')
    .map((file) => ({ ...file, kind: 'config' as const, readOnly: file.name.endsWith('.default') }))
}
