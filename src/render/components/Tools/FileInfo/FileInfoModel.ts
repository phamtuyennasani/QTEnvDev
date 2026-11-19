export const fileHashAlgorithms = ['md5', 'sha1', 'sha256', 'sha512', 'sha512Base64'] as const
export type FileHashAlgorithm = typeof fileHashAlgorithms[number]
export type FileMetadata = { size: number; atimeMs: number; mtimeMs: number; ctimeMs: number; birthtimeMs: number }
type FileInfoDependencies = {
  stat(path: string): Promise<FileMetadata | null | undefined>
  hash(path: string, algorithm: FileHashAlgorithm): Promise<string>
}
const emptyHashes = (): Record<FileHashAlgorithm, string> => ({ md5: '', sha1: '', sha256: '', sha512: '', sha512Base64: '' })

/** Metadata and hashes are independent reads. A newer selection owns the displayed result. */
export class FileInfoModel {
  path = ''
  metadata?: FileMetadata
  hashes = emptyHashes()
  errors: Partial<Record<'metadata' | FileHashAlgorithm, string>> = {}
  running = false
  unknown = false
  private generation = 0
  private operation?: Promise<boolean>
  private timer?: ReturnType<typeof setTimeout>

  constructor(private readonly dependencies: FileInfoDependencies, private readonly observationMilliseconds = 60000) {}

  inspect(path: string) {
    if (path === this.path && this.running && this.operation) return this.operation
    const generation = ++this.generation
    if (this.timer) clearTimeout(this.timer)
    this.path = path
    this.metadata = undefined
    this.hashes = emptyHashes()
    this.errors = {}
    this.unknown = false
    this.running = Boolean(path)
    if (!path) return Promise.resolve(false)
    const current = () => generation === this.generation
    const recordFailure = (field: 'metadata' | FileHashAlgorithm, failure: unknown) => {
      if (current()) this.errors[field] = failure instanceof Error ? failure.message : String(failure)
    }
    this.timer = setTimeout(() => { if (current()) this.unknown = true }, this.observationMilliseconds)
    const metadata = Promise.resolve().then(() => this.dependencies.stat(path)).then((stats) => {
      if (!stats || !Number.isFinite(stats.size) || stats.size < 0 ||
        [stats.atimeMs, stats.mtimeMs, stats.ctimeMs, stats.birthtimeMs].some((value) => !Number.isFinite(value) || Math.abs(value) > 8.64e15)) {
        throw new Error('File metadata could not be read.')
      }
      if (current()) this.metadata = { size: stats.size, atimeMs: stats.atimeMs, mtimeMs: stats.mtimeMs, ctimeMs: stats.ctimeMs, birthtimeMs: stats.birthtimeMs }
    }).catch((failure) => recordFailure('metadata', failure))
    const hashes = fileHashAlgorithms.map((algorithm) => Promise.resolve().then(() => this.dependencies.hash(path, algorithm)).then((value) => {
      if (typeof value !== 'string' || !value) throw new Error('Hash could not be read.')
      if (current()) this.hashes[algorithm] = value
    }).catch((failure) => recordFailure(algorithm, failure)))
    const operation = Promise.all([metadata, ...hashes]).then(() => {
      if (!current()) return false
      if (this.timer) clearTimeout(this.timer)
      this.timer = undefined
      this.running = false
      this.unknown = false
      this.operation = undefined
      return Object.keys(this.errors).length === 0
    })
    this.operation = operation
    return operation
  }
}
