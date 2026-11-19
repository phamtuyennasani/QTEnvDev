import type { WebsiteBackupPreview } from '../../fork/module/Host/WebsiteBackup'
import { websiteError, WebsiteOutcomeUnknown, type WebsiteHost } from './types'

type Progress = (message: string, waiting?: boolean) => void
type ExportResult = { count: number; warnings: string[] }
type ImportResult =
  | (ExportResult & { outcome: 'committed'; host: WebsiteHost[] })
  | { outcome: 'unknown'; message: string }
type Dependencies = {
  choose: (action: 'import' | 'export') => Promise<string | undefined>
  exportFile: (file: string, progress: Progress) => Promise<ExportResult>
  previewFile: (file: string) => Promise<WebsiteBackupPreview>
  importFile: (file: string, token: string, progress: Progress) => Promise<ImportResult>
  exclusive: <T>(operation: () => Promise<T>) => Promise<T>
  reconcile: (hosts: WebsiteHost[]) => void
  afterImport: () => Promise<string[]>
  notice: (message: string) => void
}

export class WebsiteBackupController {
  busy = false
  waiting = false
  error = ''
  message = ''
  warnings: string[] = []
  preview?: Readonly<WebsiteBackupPreview>
  file = ''
  private flight?: Promise<boolean>

  constructor(private readonly deps: Dependencies) {}

  exportBackup() {
    return this.run(async () => {
      const file = await this.deps.choose('export')
      if (!file) return false
      this.preview = undefined
      this.file = file
      const result = await this.deps.exclusive(() =>
        this.deps.exportFile(file, (message, waiting) => this.progress(message, waiting))
      )
      this.warnings = result.warnings
      this.complete(`Exported ${result.count} website${result.count === 1 ? '' : 's'}.`)
      return true
    })
  }

  chooseBackup() {
    return this.run(async () => {
      const file = await this.deps.choose('import')
      if (!file) return false
      this.preview = undefined
      this.file = file
      this.message = 'Checking website backup…'
      this.preview = Object.freeze(await this.deps.previewFile(file))
      this.message = ''
      return true
    })
  }

  confirmImport() {
    if (this.flight) return this.flight
    if (!this.preview || !this.file) return Promise.resolve(false)
    const { file, preview } = this
    const token = preview.token
    return this.run(() =>
      this.deps.exclusive(async () => {
        this.preview = undefined
        const result = await this.deps.importFile(file, token, (message, waiting) =>
          this.progress(message, waiting)
        )
        this.waiting = false
        if (result.outcome === 'unknown') throw new WebsiteOutcomeUnknown(result.message)
        this.warnings = result.warnings.slice()
        try {
          this.deps.reconcile(result.host)
        } catch (error) {
          this.warnings.push('Website list: ' + websiteError(error))
        }
        this.message = 'Websites imported. Synchronizing services…'
        try {
          this.warnings.push(...(await this.deps.afterImport()))
        } catch (error) {
          this.warnings.push('Service synchronization: ' + websiteError(error))
        }
        this.complete(`Imported ${result.count} website${result.count === 1 ? '' : 's'}.`)
        return true
      })
    )
  }

  private progress(message: string, waiting = false) {
    this.message = message
    this.waiting = waiting
  }

  private complete(message: string) {
    this.message = message
    try {
      this.deps.notice(message)
    } catch (error) {
      console.error(error)
    }
  }

  private run(operation: () => Promise<boolean>): Promise<boolean> {
    if (this.flight) return this.flight
    this.busy = true
    this.error = ''
    this.message = ''
    this.warnings = []
    const flight = Promise.resolve()
      .then(operation)
      .catch((error) => {
        this.error = websiteError(error)
        this.message = ''
        return false
      })
      .finally(() => {
        this.busy = false
        this.waiting = false
        this.flight = undefined
      })
    this.flight = flight
    return flight
  }
}
