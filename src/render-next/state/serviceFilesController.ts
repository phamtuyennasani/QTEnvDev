import { reactive } from 'vue'
import IPC from '@/util/IPC'
import { fs, shell } from '@/util/NodeFn'
import { packageError } from '../packages/types'
import { serviceModuleFlags, currentServiceVersion } from '../adapters/serviceAdapter'

export type ServiceFile = { name: string; path: string; exists?: boolean; kind: 'config' | 'log' }
type Reply = { code?: number; data?: unknown; msg?: unknown }
const request = (flag: string, method: string, version: unknown) => new Promise<unknown>((resolve, reject) => {
  const sent = IPC.send('app-fork:' + flag, method, version)
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
  loading = false
  saving = false
  error = ''
  private generation = 0
  async open(name: string, version: unknown, kind: 'config' | 'log' = 'log') {
    const flag = serviceModuleFlags[name]
    if (!flag) { this.error = 'This service does not expose a migrated file provider.'; return false }
    const generation = ++this.generation
    this.loading = true; this.error = ''; this.content = ''; this.selected = undefined
    try {
      const method = kind === 'config' ? 'listConfigFiles' : 'listLogFiles'
      const target = typeof version === 'string' || version === undefined ? currentServiceVersion(name) : version
      const data = await request(flag, method, target ? JSON.parse(JSON.stringify(target)) : undefined)
      if (generation !== this.generation) return false
      const list = Array.isArray(data) ? data : []
      this.files = list.filter((item): item is { name: string; path: string; exists?: boolean } => Boolean(item && typeof item.name === 'string' && typeof item.path === 'string')).map((item) => ({ ...item, kind }))
      this.selected = this.files.find((item) => item.exists !== false) || this.files[0]
      if (this.selected) await this.readSelected(generation)
      return true
    } catch (error) { if (generation === this.generation) this.error = packageError(error); return false }
    finally { if (generation === this.generation) this.loading = false }
  }
  async select(file: ServiceFile) { this.selected = file; this.error = ''; this.content = ''; if (file.kind === 'config') await this.readSelected(this.generation) }
  async readSelected(generation = this.generation) {
    const file = this.selected
    if (!file || generation !== this.generation) return
    try { this.content = await fs.readFileStrict(file.path) } catch (error) { if (generation === this.generation) this.error = packageError(error) }
  }
  async save() {
    const file = this.selected
    if (!file || file.kind !== 'config' || this.saving) return false
    this.saving = true; this.error = ''
    try { await fs.writeFile(file.path, this.content); return true }
    catch (error) { this.error = packageError(error); return false }
    finally { this.saving = false }
  }
  async reveal(file = this.selected) { if (!file) return; try { await shell.showItemInFolder(file.path) } catch (error) { this.error = packageError(error) } }
  clear() { this.generation++; this.files = []; this.selected = undefined; this.content = ''; this.error = ''; this.loading = false }
}
export const serviceFilesController = reactive(new ServiceFilesController())
