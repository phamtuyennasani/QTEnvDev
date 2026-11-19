import { reactiveBind } from '@/util/Index'
import { dialog, fs, shell } from '@/util/NodeFn'
import { join } from '@/util/path-browserify'
import { websiteError } from '../websites/types'
import { showNotice } from './app'

const definitions = {
  nginx: ['Nginx HTTP', 'nginx.vhost'],
  nginxSSL: ['Nginx HTTPS', 'nginxSSL.vhost'],
  apache: ['Apache HTTP', 'apache.vhost'],
  apacheSSL: ['Apache HTTPS', 'apacheSSL.vhost'],
  caddy: ['Caddy HTTP', 'CaddyfileVhost'],
  caddySSL: ['Caddy HTTPS', 'CaddyfileVhostSSL'],
  frankenphp: ['FrankenPHP HTTP', 'FrankenphpVhost'],
  frankenphpSSL: ['FrankenPHP HTTPS', 'FrankenphpVhostSSL']
} as const

export type VhostTemplateKey = keyof typeof definitions
export const vhostTemplateOptions = (Object.keys(definitions) as VhostTemplateKey[]).map((key) => ({
  key,
  label: definitions[key][0]
}))

export type VhostTemplateSnapshot = Readonly<{
  key: VhostTemplateKey
  source: string
  content: string
}>

function pathsFor(key: VhostTemplateKey) {
  const { BaseDir, Static } = window.Server ?? {}
  if (!BaseDir || !Static) throw new Error('The application data directory is not ready.')
  const directory = join(BaseDir, 'VhostTemplate')
  return {
    directory,
    custom: join(directory, key + '.vhost'),
    fallback: join(Static, 'tmpl', definitions[key][1])
  }
}

async function readTemplate(
  key: VhostTemplateKey,
  { custom, fallback }: ReturnType<typeof pathsFor>
): Promise<VhostTemplateSnapshot> {
  try {
    return { key, source: custom, content: await fs.readFileStrict(custom) }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error
  }
  return { key, source: fallback, content: await fs.readFileStrict(fallback) }
}

class VhostTemplateController {
  saving = false
  importing = false
  exporting = false

  get busy() {
    return this.saving || this.importing || this.exporting
  }

  async load(key: VhostTemplateKey): Promise<VhostTemplateSnapshot> {
    return readTemplate(key, pathsFor(key))
  }

  async loadDefault(key: VhostTemplateKey): Promise<string> {
    return fs.readFileStrict(pathsFor(key).fallback)
  }

  async importDraft(): Promise<string | undefined> {
    if (this.busy) return undefined
    this.importing = true
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Import vhost template',
        properties: ['openFile', 'showHiddenFiles']
      })
      const path = filePaths?.[0]
      if (canceled || !path) return undefined
      const info = (await fs.stat(path)) as unknown as { size: number; isFile: boolean } | null
      if (!info?.isFile) throw new Error('Select a regular template file.')
      if (info.size > 5 * 1024 * 1024) throw new Error('Template files are limited to 5 MiB.')
      return await fs.readFileStrict(path)
    } finally {
      this.importing = false
    }
  }

  async exportDraft(key: VhostTemplateKey, draft: string): Promise<void> {
    if (this.busy) return
    this.exporting = true
    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: key + '-custom.vhost',
        properties: ['createDirectory', 'showOverwriteConfirmation']
      })
      if (canceled || !filePath) return
      await fs.writeFile(filePath, draft)
    } catch (error) {
      showNotice(websiteError(error))
      return
    } finally {
      this.exporting = false
    }
    showNotice('Template copy saved.')
  }

  async save(snapshot: VhostTemplateSnapshot, content: string): Promise<string | undefined> {
    if (this.busy) return 'A template file operation is already running.'
    const { key, source, content: baseline } = snapshot
    this.saving = true
    try {
      const paths = pathsFor(key)
      const current = await readTemplate(key, paths)
      if (current.source !== source || current.content !== baseline) {
        return 'This template changed on disk. Reload it before saving.'
      }
      await fs.mkdirp(paths.directory)
      await fs.writeFile(paths.custom, content)
    } catch (error) {
      const message = websiteError(error)
      showNotice(message)
      return message
    } finally {
      this.saving = false
    }
    showNotice(definitions[key][0] + ' template saved.')
    return undefined
  }

  async reveal(source: string): Promise<void> {
    try {
      await shell.showItemInFolder(source)
    } catch (error) {
      showNotice(websiteError(error))
    }
  }
}

export const vhostTemplateController = reactiveBind(new VhostTemplateController())
