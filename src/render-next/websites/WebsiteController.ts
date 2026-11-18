import { cloneHost, editableWebsite, normalizeWebsite, projectFromHost, websiteUrl } from './model'
import { websiteError, WebsiteOutcomeUnknown, type WebsiteAction, type WebsiteDependencies, type WebsiteHost, type WebsiteOperation, type ProjectItem } from './types'

export class WebsiteController {
  projects: ProjectItem[] = []
  selected: { project?: ProjectItem } = {}
  loading = false
  saving = false
  error = ''
  operation?: WebsiteOperation
  private refreshFlight?: Promise<boolean>
  private mutation?: Promise<boolean>
  constructor(private deps: WebsiteDependencies) {}
  select(project: ProjectItem) { this.selected.project = project }
  refresh(): Promise<boolean> {
    if (this.refreshFlight) return this.refreshFlight
    if (this.mutation) return this.mutation
    this.loading = true
    this.error = ''
    const flight = Promise.resolve().then(async () => {
      this.assertReady()
      this.apply(await this.deps.list())
      return true
    }).catch((error) => { this.error = websiteError(error); return false })
      .finally(() => { this.loading = false; this.refreshFlight = undefined })
    this.refreshFlight = flight
    return flight
  }
  save(input: WebsiteHost, old?: WebsiteHost): Promise<boolean> {
    if (this.mutation) return Promise.resolve(false)
    let host: WebsiteHost
    try {
      if (!editableWebsite(input)) throw new Error('This project uses a dedicated runtime editor, which is pending migration.')
      host = normalizeWebsite(input)
      if (old && host.id !== old.id) throw new Error('The website identity changed. Reopen its editor.')
    } catch (error) { this.error = websiteError(error); return Promise.resolve(false) }
    return this.mutate(host, old ? 'edit' : 'add', old)
  }
  remove(project: ProjectItem, confirmation: string): Promise<boolean> {
    if (confirmation !== project.domain) { this.error = 'Type the exact hostname to confirm removal.'; return Promise.resolve(false) }
    return this.mutate(project.host, 'del', project.host)
  }
  async open(project: ProjectItem, server: 'nginx' | 'apache' | 'caddy' | 'frankenphp' | 'tomcat' = 'nginx') {
    try { this.assertReady(); await this.deps.open(websiteUrl(project.host, server)) }
    catch (error) { this.notify(websiteError(error)) }
  }
  async choosePath(file: boolean, current: string) {
    try { this.assertReady(); return await this.deps.choosePath(file, current) }
    catch (error) { this.notify(websiteError(error)); return undefined }
  }
  logs(project: ProjectItem) { return this.deps.logFiles(project.id) }
  async reveal(path: string) {
    try { this.assertReady(); await this.deps.reveal(path) }
    catch (error) { this.notify(websiteError(error)) }
  }
  private mutate(input: WebsiteHost, action: WebsiteAction, old?: WebsiteHost): Promise<boolean> {
    if (this.mutation || this.refreshFlight) return Promise.resolve(false)
    if (this.operation?.status === 'unknown') { this.error = 'The last write has an unknown result. Check hosts and the backend operation before reloading this window; automatic replay is disabled.'; return Promise.resolve(false) }
    const host = Object.freeze(cloneHost(input))
    const previous = old ? Object.freeze(cloneHost(old)) : undefined
    this.error = ''
    this.saving = true
    this.operation = { id: host.id, action, status: 'running', message: action === 'del' ? 'Removing host configuration…' : 'Saving host configuration…', warnings: [] }
    const operation = this.operation
    const flight = Promise.resolve().then(async () => {
      this.assertReady()
      const current = await this.deps.list()
      const existing = current.find((candidate) => candidate.id === host.id)
      if (action === 'add' && existing) throw new Error('This website identity already exists. Refresh and open its editor.')
      if (action !== 'add' && (!existing || !previous || JSON.stringify(existing) !== JSON.stringify(previous))) {
        throw new Error('This website changed after it was opened. Refresh the list before editing or removing it.')
      }
      if (action !== 'del') await this.deps.validate(host)
      const hosts = await this.deps.write(host, action, previous, (message) => { operation.message = message })
      operation.status = 'success'
      operation.message = action === 'del' ? 'Website configuration removed. Project files were kept.' : 'Website configuration saved.'
      this.projects = hosts.map(projectFromHost)
      this.selected.project = this.projects.find((item) => item.id === host.id) || this.projects[0]
      try { this.deps.reconcile(hosts) } catch (error) { operation.warnings.push('Domain refresh: ' + websiteError(error)) }
      try { operation.warnings.push(...await this.deps.afterCommit()) }
      catch (error) { operation.warnings.push('Post-save synchronization: ' + websiteError(error)) }
      this.notify(operation.message + (operation.warnings.length ? ' Check the synchronization warnings.' : ''))
      return true
    }).catch((error) => {
      operation.status = error instanceof WebsiteOutcomeUnknown ? 'unknown' : 'failed'
      operation.message = websiteError(error)
      this.error = operation.message
      this.notify(operation.message)
      return false
    }).finally(() => { this.saving = false; this.mutation = undefined })
    this.mutation = flight
    return flight
  }
  private apply(hosts: WebsiteHost[]) {
    const selectedId = this.selected.project?.id
    this.projects = hosts.map(projectFromHost)
    this.selected.project = this.projects.find((item) => item.id === selectedId) || this.projects[0]
    this.deps.reconcile(hosts)
  }
  private assertReady() { if (!this.deps.ready()) throw new Error('The desktop environment is not ready. Retry after startup completes.') }
  private notify(message: string) { try { this.deps.notice(message) } catch (error) { console.error(error) } }
}
