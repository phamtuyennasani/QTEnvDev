import { I18nT } from '@lang/index'
import { BrewStore, type SoftInstalled } from '@/store/brew'
import { MessageError } from '@/util/Element'
import { reactiveBind } from '@/util/Index'
import { dirname, join, normalize, resolve } from '@/util/path-browserify'
import { StorageGetAsync, StorageSetAsync } from '@/util/Storage'
import { SHA256 } from 'crypto-js'
import { effectScope, watch, type EffectScope } from 'vue'
import {
  filterJavaCandidates,
  javaMajorFromVersion,
  resolveNeo4jJavaPolicy,
  sortJavaCandidatesByVersion,
  type Neo4jJavaCandidate
} from './policy'

const storageKey = 'qtenvdev-neo4j-java-bindings'

export type Neo4jJavaBinding = {
  javaHome: string
  javaMajor: number
}

/** Keep a binding stable when the same installation is represented with different separators. */
export const normalizeNeo4jBin = (bin: string | undefined | null) => {
  const value = `${bin ?? ''}`.trim().replaceAll('\\', '/')
  return value.replace(/\/+/g, '/').replace(/\/$/, '')
}

const copyBindings = (value: unknown): Record<string, Neo4jJavaBinding> => {
  if (!value || typeof value !== 'object') return {}
  const result: Record<string, Neo4jJavaBinding> = {}
  Object.entries(value as Record<string, unknown>).forEach(([bin, binding]) => {
    if (!binding || typeof binding !== 'object') return
    const item = binding as Partial<Neo4jJavaBinding>
    if (typeof item.javaHome !== 'string' || !item.javaHome.trim()) return
    const javaMajor = Number(item.javaMajor)
    if (!Number.isFinite(javaMajor) || javaMajor <= 0) return
    result[normalizeNeo4jBin(bin)] = {
      javaHome: item.javaHome,
      javaMajor
    }
  })
  return result
}

/**
 * Owns Neo4j-to-Java bindings outside AppStore config.  The singleton survives
 * page re-entry while the reactive wrapper keeps the Java select rows current.
 */
export class Neo4jJavaBindingManager {
  javaByBin: Record<string, Neo4jJavaBinding> = {}
  savingJava: Record<string, boolean> = {}
  discoveringJava = false
  javaDiscoveryError = ''
  inited = false
  private initPromise?: Promise<void>
  private mutationQueue: Promise<void> = Promise.resolve()
  private javaDiscovery?: Promise<void>
  private installedVersionsWatching = false
  private installedVersionsScope?: EffectScope

  private enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.mutationQueue.then(operation, operation)
    this.mutationQueue = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  async init() {
    if (this.inited) return
    if (!this.initPromise) {
      this.initPromise = StorageGetAsync<Record<string, Neo4jJavaBinding>>(storageKey)
        .then((saved) => {
          Object.assign(this.javaByBin, copyBindings(saved))
          this.inited = true
        })
        .finally(() => {
          this.initPromise = undefined
        })
    }
    await this.initPromise
  }

  getBinding(bin: string | undefined | null): Neo4jJavaBinding | undefined {
    // This method is called while rendering each service-table row. Keep it
    // strictly read-only; initialization belongs to setup/actions, never render.
    return this.javaByBin[normalizeNeo4jBin(bin)]
  }

  async setBinding(bin: string, binding: Neo4jJavaBinding) {
    const key = normalizeNeo4jBin(bin)
    if (!key) throw new Error('Neo4j installation path is required')
    if (!binding?.javaHome || !Number.isFinite(binding.javaMajor)) {
      throw new Error(
        I18nT('base.serviceRequiresRuntime', {
          service: 'Neo4j',
          runtime: 'Java',
          module: 'Java'
        })
      )
    }
    await this.init()
    return this.enqueueMutation(async () => {
      const next = {
        javaHome: binding.javaHome,
        javaMajor: Number(binding.javaMajor)
      }
      await this.persist({ ...this.javaByBin, [key]: next })
      return next
    })
  }

  async removeBinding(bin: string) {
    await this.init()
    return this.enqueueMutation(async () => {
      const next = { ...this.javaByBin }
      delete next[normalizeNeo4jBin(bin)]
      await this.persist(next)
    })
  }

  discoverJava() {
    if (this.javaDiscovery) return this.javaDiscovery
    this.discoveringJava = true
    this.javaDiscoveryError = ''
    this.javaDiscovery = Promise.resolve().then(async () => {
      try {
        const [, fetched] = await Promise.all([
          this.init(),
          BrewStore().module('java').fetchInstalled()
        ])
        if (!fetched) throw new Error('Installed Java versions could not be loaded.')
      } catch (error) {
        this.javaDiscoveryError = error instanceof Error ? error.message : String(error)
      } finally {
        this.discoveringJava = false
        this.javaDiscovery = undefined
      }
    })
    return this.javaDiscovery
  }

  async chooseJava(bin: string, javaHome: string) {
    const key = normalizeNeo4jBin(bin)
    if (!key || this.savingJava[key]) return
    this.savingJava[key] = true
    try {
      await this.init()
      await this.enqueueMutation(async () => {
        const item = BrewStore()
          .module('neo4j')
          .installed.find((version) => version.bin === bin)
        if (!item || item.run || item.running) {
          throw new Error('Stop this Neo4j installation before changing Java.')
        }
        const candidate = this.candidatesForVersion(item.version).find(
          (version) => version.path === javaHome
        )
        const javaMajor = candidate && this.candidateMajor(candidate)
        if (!candidate || !javaMajor) throw new Error('Select a compatible installed Java runtime.')
        await this.persist({ ...this.javaByBin, [key]: { javaHome: candidate.path, javaMajor } })
      })
      return true
    } catch (error) {
      MessageError(error instanceof Error ? error.message : String(error))
      return false
    } finally {
      delete this.savingJava[key]
    }
  }

  watchInstalledVersions() {
    if (this.installedVersionsWatching) return
    this.installedVersionsWatching = true
    const neo4jModule = BrewStore().module('neo4j')
    const javaModule = BrewStore().module('java' as any)
    this.installedVersionsScope = effectScope(true)
    this.installedVersionsScope.run(() => {
      watch(
        () => ({
          neo4jFetched: neo4jModule.installedFetched,
          neo4j: neo4jModule.installed.map((item) => [item.bin, item.path, item.version]),
          java: javaModule.installed.map((item) => [item.bin, item.path, item.version, item.num])
        }),
        () => {
          if (!neo4jModule.installedFetched) return
          this.reconcileBindings(neo4jModule.installed).catch((error) =>
            console.error('Neo4j Java binding reconciliation failed', error)
          )
        },
        { immediate: true }
      )
    })
  }

  stopInstalledVersionsWatch() {
    this.installedVersionsScope?.stop()
    this.installedVersionsScope = undefined
    this.installedVersionsWatching = false
  }

  /** Remove stale paths and initialize new rows with the recommended local JDK. */
  async reconcileBindings(installed: SoftInstalled[]) {
    const neo4jModule = BrewStore().module('neo4j')
    if (!neo4jModule.installedFetched && installed.length === 0) return
    await this.init()
    return this.enqueueMutation(async () => {
      const bins = new Set(installed.map((item) => normalizeNeo4jBin(item.bin)).filter(Boolean))
      const next = { ...this.javaByBin }
      let changed = false
      Object.keys(this.javaByBin).forEach((bin) => {
        if (!bins.has(bin)) {
          delete next[bin]
          changed = true
        }
      })

      const javaCandidates = this.javaCandidates()
      installed.forEach((item) => {
        if (!item.version || this.getBinding(item.bin)) return
        const candidate = filterJavaCandidates(item.version, javaCandidates)[0]
        if (!candidate) return
        const javaMajor = this.candidateMajor(candidate)
        if (!javaMajor) return
        next[normalizeNeo4jBin(item.bin)] = {
          javaHome: candidate.path,
          javaMajor
        }
        changed = true
      })
      if (changed) await this.persist(next)
    })
  }

  javaCandidates(): Neo4jJavaCandidate[] {
    const java = BrewStore().module('java' as any)
    return java.installed.map((item) => ({
      bin: item.bin,
      path: item.path,
      version: item.version,
      num: item.num
    }))
  }

  candidatesForVersion(version: string | null | undefined) {
    return sortJavaCandidatesByVersion(filterJavaCandidates(version, this.javaCandidates()))
  }

  policyForVersion(version: string | null | undefined) {
    return resolveNeo4jJavaPolicy(version)
  }

  candidateMajor(candidate: Neo4jJavaCandidate) {
    return candidate.num
      ? Number(String(candidate.num).slice(0, 2))
      : javaMajorFromVersion(candidate.version)
  }

  /** Derive the same per-installation directory as the Neo4j fork runtime. */
  instanceDirFor(item: Pick<SoftInstalled, 'bin' | 'path'>): string {
    const installationPath = item.path || dirname(dirname(item.bin || ''))
    let canonical = normalize(resolve(installationPath)).replace(/[\\/]+$/, '')
    if (window.Server.isWindows) canonical = canonical.replaceAll('/', '\\')
    const key = SHA256(canonical).toString().slice(0, 16)
    const moduleDir = window.Server.Neo4jDir ?? join(window.Server.BaseDir!, 'neo4j')
    return join(moduleDir, 'instances', key)
  }

  /** Parameters appended to the existing ModuleInstalledItem startService IPC call. */
  async startParams(
    item: SoftInstalled
  ): Promise<[{ javaHome: string; neo4jInstanceDir: string }]> {
    await this.init()
    await this.mutationQueue
    const binding = this.getBinding(item.bin)
    if (!binding) throw new Error('Select a compatible Java runtime before starting Neo4j')
    const policy = resolveNeo4jJavaPolicy(item.version)
    if (!policy.supportedMajor.includes(binding.javaMajor)) {
      throw new Error(
        `Java ${binding.javaMajor} is not compatible with Neo4j ${item.version ?? ''}`
      )
    }
    return [
      {
        javaHome: binding.javaHome,
        neo4jInstanceDir: this.instanceDirFor(item)
      }
    ]
  }

  /** Keep stopping available after a Java binding is removed or becomes invalid. */
  async stopParams(
    item: SoftInstalled
  ): Promise<[{ javaHome?: string; neo4jInstanceDir: string }]> {
    await this.init().catch(() => undefined)
    return [
      {
        javaHome: this.getBinding(item.bin)?.javaHome,
        neo4jInstanceDir: this.instanceDirFor(item)
      }
    ]
  }

  private async persist(bindings: Record<string, Neo4jJavaBinding>) {
    await StorageSetAsync(storageKey, copyBindings(bindings))
    this.javaByBin = bindings
  }
}

export const Neo4jManager = reactiveBind(new Neo4jJavaBindingManager())
