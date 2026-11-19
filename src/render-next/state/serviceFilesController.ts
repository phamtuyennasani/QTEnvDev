import { reactive } from 'vue'
import IPC from '@/util/IPC'
import { fs, shell } from '@/util/NodeFn'
import { Project } from '@/util/Project'
import { packageError } from '../packages/types'
import { serviceModuleFlags, currentServiceVersion, serviceFileContext } from '../adapters/serviceAdapter'

export type ServiceFile = { name: string; path: string; exists?: boolean; kind: 'config' | 'log'; readOnly?: boolean }
export type ServiceFileEditor = 'VSCode' | 'PhpStorm' | 'WebStorm' | 'Sublime'
type Reply = { code?: number; data?: unknown; msg?: unknown }
const request = (flag: string, method: string, version: unknown, ...context: unknown[]) => new Promise<unknown>((resolve, reject) => {
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
  loading = false
  saving = false
  openingExternal = false
  error = ''
  warning = ''
  private generation = 0
  private readGeneration = 0
  get canEdit() {
    return this.selected?.kind === 'config' && !this.selected.readOnly &&
      !this.saving && this.loadedContent !== undefined
  }
  get canSave() {
    return this.canEdit && this.content !== this.loadedContent
  }

  async openProvided(provider: () => Promise<ServiceFile[]>) {
    this.clear()
    const generation = this.generation
    this.loading = true
    try {
      const files = await provider()
      if (generation !== this.generation) return
      this.files = files
      this.selected = files[0]
      if (this.selected) await this.readSelected(generation)
    } catch (error) {
      if (generation === this.generation) this.error = packageError(error)
    } finally {
      if (generation === this.generation) this.loading = false
    }
  }

  async open(name: string, version: unknown, kind: 'config' | 'log' = 'log', onlyName?: string) {
    const flag = serviceModuleFlags[name]
    if (!flag) { this.error = 'This service does not expose a migrated file provider.'; return false }
    const generation = ++this.generation
    this.loading = true; this.error = ''; this.content = ''; this.loadedContent = undefined; this.selected = undefined
    try {
      const target = typeof version === 'string' || version === undefined ? currentServiceVersion(name) : version
      const snapshot = target ? JSON.parse(JSON.stringify(target)) : undefined
      let data: unknown
      if (name === 'PHP' && kind === 'config') {
        if (!snapshot) throw new Error('Select an installed PHP version first.')
        const path = await request(flag, 'getIniPath', snapshot)
        if (typeof path !== 'string' || !path) throw new Error('PHP did not report its configuration file.')
        data = [{ name: 'php.ini', path }]
      } else {
        const context = await serviceFileContext(flag, snapshot)
        data = await request(flag, kind === 'config' ? 'listConfigFiles' : 'listLogFiles', snapshot, ...context)
      }
      if (generation !== this.generation) return false
      const list = Array.isArray(data) ? data : []
      this.files = list.filter((item): item is { name: string; path: string; exists?: boolean } => Boolean(item && typeof item.name === 'string' && typeof item.path === 'string')).map((item) => ({ ...item, kind }))
      if (onlyName) this.files = this.files.filter((item) => item.name === onlyName)
      this.selected = this.files.find((item) => item.exists !== false) || this.files[0]
      if (this.selected) await this.readSelected(generation)
      return true
    } catch (error) { if (generation === this.generation) this.error = packageError(error); return false }
    finally { if (generation === this.generation) this.loading = false }
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
    try {
      const raw = await (file.kind === 'log' ? fs.readLogTail(file.path) : fs.readFileStrict(file.path))
      if (!current()) return
      this.content = raw
      if (file.kind === 'config') this.loadedContent = raw
    } catch (error) { if (current()) this.error = packageError(error) }
  }
  async save(afterSave?: (file: ServiceFile) => Promise<string[]>) {
    const file = this.selected
    if (!file || !this.canSave) return false
    const original = this.loadedContent
    const content = this.content
    const generation = this.generation
    this.saving = true; this.error = ''; this.warning = ''
    try {
      const current = await fs.readFileStrict(file.path)
      if (generation !== this.generation) return false
      if (current !== original) { this.error = 'The file changed outside this editor. Reload it before saving.'; return false }
      await fs.writeFile(file.path, content)
      if (generation === this.generation) this.loadedContent = content
      if (afterSave) {
        let warnings: string[]
        try { warnings = await afterSave(file) }
        catch (error) { warnings = [packageError(error)] }
        if (generation === this.generation) this.warning = ['Configuration saved.', ...warnings].join(' ')
      }
      return true
    }
    catch (error) { if (generation === this.generation) this.error = packageError(error); return false }
    finally { this.saving = false }
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

  async openExternal(file: ServiceFile, editor: ServiceFileEditor) {
    if (this.openingExternal || this.saving || file.kind !== 'config' || this.selected !== file) return false
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

  clear() { this.generation++; this.files = []; this.selected = undefined; this.content = ''; this.loadedContent = undefined; this.error = ''; this.warning = ''; this.loading = false }
}
export const serviceFilesController = reactive(new ServiceFilesController())
