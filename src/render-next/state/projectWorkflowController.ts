import { reactiveBind } from '@/util/Index'
import { shell } from '@/util/NodeFn'
import { ProjectSetup } from '@/components/LanguageProjects/setup'
import type { ProjectItem } from '@/components/LanguageProjects/ProjectItem'
import { BrewStore } from '@/store/brew'
import { inspectProjectPorts } from '@/components/LanguageProjects/ports'
import { showNotice } from './app'

export const workflowLabels = { php: 'PHP', node: 'Node.js', python: 'Python', golang: 'Go' } as const
export type WorkflowKind = keyof typeof workflowLabels
export type WorkflowProject = { id: string; kind: WorkflowKind; item: ProjectItem }

/** Renderer-lifetime owner for language project discovery and process actions. */
class ProjectWorkflowController {
  private sources: Partial<Record<WorkflowKind, ReturnType<typeof ProjectSetup>>> = {}
  loading = false
  busy = false
  error = ''
  private loadFlight?: Promise<boolean>
  private actionFlights = new Map<string, Promise<boolean>>()

  get projects(): WorkflowProject[] {
    return (Object.keys(workflowLabels) as WorkflowKind[]).flatMap((kind) =>
      (this.sources[kind]?.project ?? []).map((item) => ({ id: kind + ':' + item.id, kind, item }))
    )
  }

  async load(): Promise<boolean> {
    if (this.loadFlight) return this.loadFlight
    this.loading = true
    this.error = ''
    const kinds = Object.keys(workflowLabels) as WorkflowKind[]
    const flight = Promise.allSettled(kinds.map(async (kind) => {
      const setup = ProjectSetup(kind)
      this.sources[kind] = setup
      await setup.fetchProject()
      if (!setup.fetched) throw new Error('Project storage could not be loaded.')
    })).then((groups) => {
      const failed = kinds.filter((_kind, index) => groups[index].status === 'rejected')
      if (!failed.length) return true
      this.error = 'Could not load projects for ' + failed.map((kind) => workflowLabels[kind]).join(', ') + '.'
      return false
    }).finally(() => { this.loading = false; this.loadFlight = undefined })
    this.loadFlight = flight
    return flight
  }

  async run(project: WorkflowProject, action: 'start' | 'stop'): Promise<boolean> {
    const key = project.id
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

  async loadRuntime(kind: WorkflowKind) {
    const module = BrewStore().module(kind)
    return module.fetchInstalled(false)
  }

  projectUrl(project: WorkflowProject) {
    return project.item.isService ? inspectProjectPorts(project.item).primaryUrl : undefined
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
