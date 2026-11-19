import { reactive } from 'vue'
import type { SoftInstalled } from '@shared/app'
import IPC from '@/util/IPC'
import { dialog, fs, shell } from '@/util/NodeFn'
import { Project } from '@/util/Project'
import { packageError } from '../packages/types'
import {
  canRestartServiceVersion,
  currentServiceVersion,
  runServiceLifecycle,
  serviceFileContext,
  serviceModuleFlags,
  type ServiceVersionTarget
} from '../adapters/serviceAdapter'
import { showNotice } from './app'

export type ServiceFile = { name: string; path: string; exists?: boolean; kind: 'config' | 'log'; readOnly?: boolean; defaultPath?: string }
export type ServiceFileEditor = 'VSCode' | 'PhpStorm' | 'WebStorm' | 'Sublime'
export type ServiceFileInitializer = (file: ServiceFile) => Promise<'created' | 'exists'>
export type ServiceFileProvider = (version?: SoftInstalled) => Promise<ServiceFile[]>
type ConfigurationAction = 'import' | 'default' | 'export'
const maxConfigurationImportBytes = 5 * 1024 * 1024
type Reply = { code?: number; data?: unknown; msg?: unknown }
type ConfigurationTarget = ServiceVersionTarget & { name: string }
export const requestServiceFile = (flag: string, method: string, version: unknown, ...context: unknown[]) => new Promise<unknown>((resolve, reject) => {
  const sent = IPC.send('app-fork:' + flag, method, version, ...context)
  const timer = setTimeout(() => { IPC.off(sent.key); reject(new Error('The service file request timed out.')) }, 60_000)
  sent.then((key: string, reply: Reply) => {
    if (reply?.code === 200) return
    clearTimeout(timer); IPC.off(key)
    if (reply?.code === 0) resolve(reply.data)
    else reject(new Error(typeof reply?.msg === 'string' ? reply.msg : 'The service file request failed.'))
  })
})

export class ServiceFilesController {
  files: ServiceFile[] = []
  selected?: ServiceFile
  content = ''
  private loadedContent?: string
  private missing = false
  loading = false
  saving = false
  restarting = false
  openingExternal = false
  restoring = false
  configurationAction?: ConfigurationAction
  error = ''
  warning = ''
  private generation = 0
  private readGeneration = 0
  private loadFiles?: () => Promise<ServiceFile[]>
  private configurationTarget?: ConfigurationTarget
  get canEdit() {
    return this.selected?.kind === 'config' && !this.selected.readOnly &&
      !this.saving && !this.restoring && !this.configurationAction && this.loadedContent !== undefined
  }
  get canSave() {
    return this.canEdit && this.content !== this.loadedContent
  }
  get canRestart() {
    const target = this.configurationTarget
    return Boolean(target && canRestartServiceVersion(target.name, target))
  }
  get canRestore() {
    return this.selected?.kind === 'config' && !this.selected.readOnly && this.missing
  }

  async openProvided(provider: () => Promise<ServiceFile[]>, preferExisting = false, configurationTarget?: ConfigurationTarget) {
    this.clear()
    const generation = this.generation
    this.loadFiles = provider
    this.configurationTarget = configurationTarget
    this.loading = true
    try {
      const files = await provider()
      if (generation !== this.generation) return false
      this.files = files
      this.selected = (preferExisting ? files.find((item) => item.exists !== false) : undefined) ?? files[0]
      if (this.selected) await this.readSelected(generation)
      return true
    } catch (error) {
      if (generation === this.generation) this.error = packageError(error)
      return false
    } finally {
      if (generation === this.generation) this.loading = false
    }
  }

  async open(name: string, version: unknown, kind: 'config' | 'log' = 'log', onlyName?: string, provider?: ServiceFileProvider) {
    const flag = serviceModuleFlags[name]
    if (!flag) { this.error = 'This service does not expose a migrated file provider.'; return false }
    const target = typeof version === 'string' || version === undefined ? currentServiceVersion(name) : version
    const snapshot = target ? JSON.parse(JSON.stringify(target)) : undefined
    let configurationTarget: ConfigurationTarget | undefined
    if (kind === 'config' && snapshot?.bin && snapshot?.version) {
      const candidate = { name, bin: snapshot.bin, version: snapshot.version }
      if (typeof version === 'object' ||
          (!provider && version === snapshot.version && canRestartServiceVersion(name, candidate, true))) {
        configurationTarget = candidate
      }
    }
    if (provider) return this.openProvided(() => provider(snapshot), false, configurationTarget)
    return this.openProvided(async () => {
      let data: unknown
      if (name === 'PHP' && kind === 'config') {
        if (!snapshot) throw new Error('Select an installed PHP version first.')
        const path = await requestServiceFile(flag, 'getIniPath', snapshot)
        if (typeof path !== 'string' || !path) throw new Error('PHP did not report its configuration file.')
        const candidate = `${path}.default`
        data = [{ name: 'php.ini', path, defaultPath: await fs.existsSync(candidate) ? candidate : undefined }]
      } else {
        const context = await serviceFileContext(flag, snapshot)
        data = await requestServiceFile(flag, kind === 'config' ? 'listConfigFiles' : 'listLogFiles', snapshot, ...context)
      }
      const list = Array.isArray(data) ? data : []
      return list.filter((item): item is Omit<ServiceFile, 'kind'> => Boolean(item && typeof item.name === 'string' && typeof item.path === 'string' && (!onlyName || item.name === onlyName))).map((item) => ({ ...item, kind }))
    }, true, configurationTarget)
  }
  async select(file: ServiceFile) {
    if (this.saving) return
    this.selected = file
    this.error = ''
    this.warning = ''
    this.content = ''
    await this.readSelected()
  }
  async readSelected(generation = this.generation) {
    const file = this.selected
    if (!file || generation !== this.generation || this.saving) return
    const read = ++this.readGeneration
    const current = () => generation === this.generation && read === this.readGeneration
    this.loadedContent = undefined
    this.missing = false
    this.error = ''
    try {
      const raw = await (file.kind === 'log' ? fs.readLogTail(file.path) : fs.readFileStrict(file.path))
      if (!current()) return
      this.content = raw
      if (file.kind === 'config') this.loadedContent = raw
    } catch (error) {
      if (current()) {
        this.missing = (error as NodeJS.ErrnoException)?.code === 'ENOENT'
        this.error = packageError(error)
      }
    }
  }
  async saveAndRestart() {
    const target = this.configurationTarget
    if (!target || !this.canRestart) return false
    return this.saveConfiguration(undefined, target)
  }

  async save(afterSave?: (file: ServiceFile) => Promise<string[]>) {
    return this.saveConfiguration(afterSave)
  }

  private async saveConfiguration(afterSave?: (file: ServiceFile) => Promise<string[]>, restartTarget?: ConfigurationTarget) {
    const file = this.selected
    if (!file || !this.canSave) return false
    const original = this.loadedContent
    const content = this.content
    const generation = this.generation
    this.saving = true; this.error = ''; this.warning = ''
    try {
      const current = await fs.readFileStrict(file.path)
      if (generation !== this.generation && !restartTarget) return false
      if (current !== original) throw new Error('The file changed outside this editor. Reload it before saving.')
      await fs.writeFile(file.path, content)
      if (generation === this.generation) this.loadedContent = content
      if (restartTarget) {
        if (generation === this.generation) this.warning = 'Configuration saved.'
        this.restarting = true
        const message = await this.restartAfterSave(restartTarget)
        if (generation === this.generation) this.warning = message
        else showNotice(message)
      } else if (afterSave) {
        let warnings: string[]
        try { warnings = await afterSave(file) }
        catch (error) { warnings = [packageError(error)] }
        if (generation === this.generation) this.warning = ['Configuration saved.', ...warnings].join(' ')
      }
      return true
    }
    catch (error) {
      if (generation === this.generation) this.error = packageError(error)
      else if (restartTarget) showNotice(packageError(error))
      return false
    }
    finally {
      this.restarting = false
      this.saving = false
      if (restartTarget && generation !== this.generation && this.selected) await this.readSelected()
    }
  }

  private async restartAfterSave(target: ConfigurationTarget) {
    try {
      const result = await runServiceLifecycle(target.name, 'restart', target)
      if (result.connected && result.result === true) {
        return `Configuration saved. ${target.name} restarted.${result.warning ? ` ${result.warning}` : ''}`
      }
      throw new Error(typeof result.result === 'string' ? result.result : 'The service did not report success.')
    } catch (error) {
      return `Configuration saved. Restart failed. ${packageError(error)}`
    }
  }
  async clearLog() {
    const file = this.selected
    if (!file || file.kind !== 'log' || this.saving) return false
    this.readGeneration++
    const generation = this.generation
    this.saving = true; this.error = ''
    try { await fs.writeFile(file.path, ''); if (generation === this.generation) this.content = ''; return true }
    catch (error) { if (generation === this.generation) this.error = packageError(error); return false }
    finally { this.saving = false }
  }
  async reveal(file = this.selected) { if (!file) return; try { await shell.showItemInFolder(file.path) } catch (error) { this.error = packageError(error) } }

  async transferConfiguration(action: ConfigurationAction) {
    const file = this.selected
    if (!file || !this.canEdit || this.openingExternal) return false
    const generation = this.generation
    const read = this.readGeneration
    const draft = this.content
    const current = () => generation === this.generation && read === this.readGeneration && this.selected === file
    this.configurationAction = action
    this.error = ''
    try {
      if (action === 'export') {
        const activeFiles = this.files.flatMap(({ path, defaultPath }) => defaultPath ? [path, defaultPath] : [path])
        if (!activeFiles.includes(file.path)) activeFiles.push(file.path)
        const filename = file.path.split(/[\\/]/).at(-1) || file.name
        const result = await dialog.showSaveDialog({
          defaultPath: `copy-${filename}`,
          properties: ['createDirectory', 'showOverwriteConfirmation']
        })
        if (result.canceled || !result.filePath) return false
        const canonical = async (path: string) => {
          const target = await fs.realpath(path)
          return globalThis.window?.Server?.isWindows ? target.replaceAll('\\', '/').toLowerCase() : target
        }
        const destination = await canonical(result.filePath)
        const sources = await Promise.all(activeFiles.map(canonical))
        if (sources.includes(destination)) throw new Error('Choose a separate path, or use Save configuration.')
        await fs.writeFile(result.filePath, draft)
        showNotice('Configuration copy saved.')
        return true
      }

      let source = file.defaultPath
      if (action === 'import') {
        const result = await dialog.showOpenDialog({
          title: 'Import configuration',
          properties: ['openFile', 'showHiddenFiles']
        })
        if (result.canceled) return false
        source = result.filePaths[0]
      }
      if (!source || !current()) return false
      const info = (await fs.stat(source)) as unknown as { size: number; isFile: boolean } | null
      if (!info?.isFile) throw new Error('Select a regular configuration file.')
      if (info.size > maxConfigurationImportBytes) throw new Error('Configuration imports are limited to 5 MiB.')
      const replacement = await fs.readFileStrict(source)
      if (!current() || this.content !== draft) return false
      this.content = replacement
      return true
    } catch (error) {
      if (current()) this.error = packageError(error)
      else if (action === 'export') showNotice(packageError(error))
      return false
    } finally {
      this.configurationAction = undefined
    }
  }

  async openExternal(file: ServiceFile, editor: ServiceFileEditor) {
    if (this.openingExternal || this.saving || this.restoring || this.configurationAction || file.kind !== 'config' || this.selected !== file) return false
    const { path } = file
    const generation = this.generation
    const current = () => generation === this.generation && this.selected === file
    this.openingExternal = true
    this.error = ''
    try {
      if (file.exists === false || (await fs.existsSync(path)) !== true) {
        throw new Error('The configuration file was not found.')
      }
      if (!current()) return false
      const result = await Project.openPath(path, editor, false)
      if (result !== true) throw new Error(result)
      return true
    } catch (error) {
      if (current()) this.error = packageError(error)
      return false
    } finally {
      this.openingExternal = false
    }
  }

  async restoreSelected(create: ServiceFileInitializer, reloadList = false) {
    const file = this.selected
    if (!file || !this.canRestore || this.saving || this.openingExternal || this.restoring || this.configurationAction) {
      return false
    }
    const generation = this.generation
    const current = () => generation === this.generation && this.selected === file
    const sameConfig = () => this.selected?.kind === 'config' && this.selected.path === file.path
    this.restoring = true
    this.error = ''
    this.warning = ''
    try {
      let result: 'created' | 'exists'
      try {
        result = await create(file)
      } catch (error) {
        if (sameConfig()) {
          // A read begun before the terminal reply cannot establish that a retry is needed.
          this.readGeneration++
          this.missing = false
        }
        if (current() || (reloadList && sameConfig())) this.error = packageError(error)
        else if (reloadList) showNotice(packageError(error))
        return false
      }
      let warning = result === 'created' ? 'Configuration created.' : 'The configuration already exists.'
      if (!current() && !(reloadList && sameConfig())) {
        if (reloadList) showNotice(warning)
        return true
      }
      const viewGeneration = this.generation
      const loadFiles = this.loadFiles
      if (reloadList && loadFiles) {
        try {
          const files = await loadFiles()
          if (viewGeneration !== this.generation) return true
          const selection = this.selected?.path
          this.files = files
          this.selected = files.find((item) => item.path === selection) ?? files[0]
        } catch (error) {
          if (viewGeneration !== this.generation) return true
          warning += ` Could not refresh the file list. ${packageError(error)}`
        }
      }
      if (viewGeneration === this.generation) {
        this.warning = warning
        await this.readSelected(viewGeneration)
      }
    } finally {
      this.restoring = false
    }
    return true
  }

  clear() { this.generation++; this.loadFiles = undefined; this.configurationTarget = undefined; this.files = []; this.selected = undefined; this.content = ''; this.loadedContent = undefined; this.missing = false; this.error = ''; this.warning = ''; this.loading = false }
}
export const serviceFilesController = reactive(new ServiceFilesController())
