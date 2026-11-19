import type { AppHost, SoftInstalled } from '@shared/app'

export type TomcatSaveRequest = {
  host: AppHost
  old?: AppHost
  flag: 'add' | 'edit' | 'del'
  version?: SoftInstalled
  catalinaBase?: string
  wasRunning: boolean
}

export type TomcatSaveResult = { host: AppHost[] }

export type TomcatSiteSavePhase = 'idle' | 'saving' | 'restarting' | 'failed' | 'unknown' | 'savedWithWarning'

export class TomcatSiteOutcomeUnknown extends Error {}

type OperationDependencies = {
  persist: (request: TomcatSaveRequest) => Promise<TomcatSaveResult>
  applyHosts: (hosts: AppHost[]) => void
  writeHosts: () => Promise<unknown>
  restart: (request: TomcatSaveRequest) => Promise<string | boolean>
}

export class TomcatSiteSaveOperation {
  saving = false
  phase: TomcatSiteSavePhase = 'idle'
  private flight: Promise<boolean> | undefined
  error: Error | undefined
  committed?: TomcatSaveResult

  constructor(private readonly dependencies: OperationDependencies) {}

  save(request: TomcatSaveRequest): Promise<boolean> {
    if (this.flight || this.saving || this.phase === 'unknown') {
      return Promise.resolve(false)
    }
    this.saving = true
    this.phase = 'saving'
    this.error = undefined
    this.committed = undefined
    const flight = this.doSave(request).finally(() => {
      if (this.flight === flight) {
        this.flight = undefined
        this.saving = false
      }
    })
    this.flight = flight
    return flight
  }

  private async doSave(request: TomcatSaveRequest): Promise<boolean> {
    let result: TomcatSaveResult
    try {
      result = await this.dependencies.persist(request)
    } catch (error) {
      this.phase = error instanceof TomcatSiteOutcomeUnknown ? 'unknown' : 'failed'
      this.error = error instanceof Error ? error : new Error(`${error}`)
      return false
    }
    this.committed = result

    const warnings: string[] = []
    try {
      this.dependencies.applyHosts(result.host)
    } catch (error) {
      warnings.push(`Website list refresh: ${error}`)
    }
    try {
      await this.dependencies.writeHosts()
    } catch (error) {
      warnings.push(`Hosts file sync: ${error}`)
    }
    if (request.wasRunning) {
      this.phase = 'restarting'
      try {
        const restarted = await this.dependencies.restart(request)
        if (restarted !== true) {
          warnings.push(`Tomcat restart: ${restarted || 'restart was not confirmed'}`)
        }
      } catch (error) {
        warnings.push(`Tomcat restart: ${error}`)
      }
    }
    this.phase = warnings.length ? 'savedWithWarning' : 'idle'
    this.error = warnings.length ? new Error(warnings.join('\n')) : undefined
    return true
  }
}
