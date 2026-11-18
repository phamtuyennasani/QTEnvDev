import { reactiveBind } from '@/util/Index'
import { shell } from '@/util/NodeFn'
import { ProjectSetup } from '@/components/LanguageProjects/setup'
import type { ProjectItem } from '@/components/LanguageProjects/ProjectItem'
import type { AllAppModule } from '@/core/type'
import { showNotice } from './app'

export type WorkflowKind = 'php' | 'nodejs' | 'python' | 'golang'
export type WorkflowProject = { id: string; kind: WorkflowKind; item: ProjectItem }

/** Renderer-lifetime owner for language project discovery and process actions. */
class ProjectWorkflowController {
  projects: WorkflowProject[] = []
  loading = false
  busy = false
  error = ''
  private loadFlight?: Promise<boolean>
  private actionFlights = new Map<string, Promise<boolean>>()

  async load(): Promise<boolean> {
    if (this.loadFlight) return this.loadFlight
    this.loading = true
    this.error = ''
    const flight = Promise.all((['php', 'nodejs', 'python', 'golang'] as WorkflowKind[]).map(async (kind) => {
      const setup = ProjectSetup(kind as AllAppModule)
      await setup.fetchProject()
      return setup.project.map((item) => ({ id: kind + ':' + item.id, kind, item }))
    })).then((groups) => { this.projects = groups.flat(); return true }).catch((error) => {
      this.error = error instanceof Error ? error.message : String(error); showNotice(this.error); return false
    }).finally(() => { this.loading = false; this.loadFlight = undefined })
    this.loadFlight = flight
    return flight
  }

  async run(project: WorkflowProject, action: 'start' | 'stop'): Promise<boolean> {
    const key = project.id + ':' + action
    const existing = this.actionFlights.get(key)
    if (existing) return existing
    this.busy = true; this.error = ''
    const flight = Promise.resolve().then(async () => {
      const result = action === 'start' ? await project.item.start() : await project.item.stop()
      if (result !== true) throw new Error(typeof result === 'string' ? result : 'Could not ' + action + ' project.')
      showNotice((project.item.comment || project.item.path) + ' ' + (action === 'start' ? 'started.' : 'stopped.'))
      return true
    }).catch((error) => { this.error = error instanceof Error ? error.message : String(error); showNotice(this.error); return false
    }).finally(() => { this.actionFlights.delete(key); this.busy = this.actionFlights.size > 0 })
    this.actionFlights.set(key, flight)
    return flight
  }

  async reveal(path: string): Promise<void> { try { await shell.showItemInFolder(path) } catch (error) { this.error = error instanceof Error ? error.message : String(error); showNotice(this.error) } }
  async revealFile(project: WorkflowProject, kind: 'log' | 'config'): Promise<void> {
    const file = (kind === 'log' ? project.item.logPath : project.item.configPath)?.[0]
    if (!file?.path) { this.error = 'This project has no configured ' + kind + ' file.'; showNotice(this.error); return }
    await this.reveal(file.path)
  }
  async open(path: string): Promise<void> { try { await shell.openPath(path) } catch (error) { this.error = error instanceof Error ? error.message : String(error); showNotice(this.error) } }
}

export const projectWorkflowController = reactiveBind(new ProjectWorkflowController())
