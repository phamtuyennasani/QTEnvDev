import {
  performanceDiagnosticNow,
  performanceDiagnosticElapsed,
  writePerformanceLog,
  measurePerformanceStep
} from '@shared/PerformanceDiagnostics'
import type { AllAppModule } from '@/core/type'
import localForage from 'localforage'
import { SetupStore } from '@/components/Setup/store'
import { MessageError } from '@/util/Element'
import { I18nT } from '@lang/index'
import { debug, fs, shell } from '@/util/NodeFn'
import { reactiveBind } from '@/util/Index'
import Base from '@/core/Base'
import { join } from '@/util/path-browserify'
import { ProjectItem } from './ProjectItem'
import { AsyncComponentShow } from '@/util/AsyncComponent'
import ShellInitController from '@/components/Tools/ShellInitController'
import { ensureDataDirectoryReady } from '@/core/DataDirectoryStartup'
import {
  roadRunnerPrimaryConfigPath,
  roadRunnerServeCommand,
  syncRoadRunnerConfigPath,
  updateRoadRunnerConfigPort,
  type RoadRunnerProjectItem
} from '@/components/RoadRunner/project'
import {
  defaultSwooleCliScriptPath,
  inferSwooleCliPreset,
  swooleCliPresetCommand,
  type SwooleCliProjectItem
} from '@/components/SwooleCli/project'

const logSetDirEnvTiming = (details: Record<string, unknown>) => {
  void writePerformanceLog(
    (category, message) => debug.log(category, message),
    '[LanguageProjects][setDirEnv][timing]',
    details
  )
}

/** 项目版本目录只作为 PowerShell 字符串数据；$、反引号和单引号不得被解释执行。 */
const windowsProjectPathLiteral = (entries: string[]): string => {
  if (
    entries.some(
      (entry) =>
        /[\x00-\x1f\x7f;]/u.test(entry) ||
        !/^(?:[a-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+(?:[\\/]|$))/iu.test(entry)
    )
  ) {
    // 不允许依赖终端当前目录的相对路径；分号无法在 PATH 单个条目中表示。
    throw new Error(
      'Project version requires full Windows paths without control characters or PATH separators'
    )
  }
  return `'${(entries.join(';') + ';').replace(/'/g, "''")}'`
}

const measureSetDirEnvStep = async <T>(
  timings: Record<string, number>,
  context: Record<string, unknown>,
  step: string,
  operation: () => Promise<T>
): Promise<T> =>
  measurePerformanceStep(step, operation, (event) => {
    const durationMs = event.durationMs ?? 0
    timings[step] = durationMs
    logSetDirEnvTiming({ event: 'step', ...context, step, durationMs })
  })

export class Project {
  allDirs: string[] = []
  fetching = false
  fetched = false
  project: ProjectItem[] = []
  search = ''
  flagType: AllAppModule = 'golang'
  private fetchProjectPromise?: Promise<void>
  private pendingSave = Promise.resolve()
  private revision = 0
  private edits = new Map<string, Promise<void>>()

  constructor(flagType: AllAppModule) {
    this.flagType = flagType
  }

  private prepareRoadRunnerProject(item: ProjectItem): boolean {
    if (this.flagType !== 'roadrunner' || !item.path) {
      return false
    }
    let changed = false
    if (!item.runCommand) {
      item.commandType = 'command'
      item.runCommand = roadRunnerServeCommand(item.path, roadRunnerPrimaryConfigPath(item))
      changed = true
    }
    const old = JSON.stringify({
      configPath: item.configPath,
      roadRunnerConfigPath: item.roadRunnerConfigPath
    })
    const rrItem = item as RoadRunnerProjectItem
    const shouldSyncConfig =
      !['custom', 'laravel-octane'].includes(`${rrItem.roadRunnerPreset}`) ||
      !!rrItem.roadRunnerConfigPath ||
      item.configPath.length > 0
    if (shouldSyncConfig) {
      syncRoadRunnerConfigPath(item)
    }
    changed =
      JSON.stringify({
        configPath: item.configPath,
        roadRunnerConfigPath: item.roadRunnerConfigPath
      }) !== old || changed
    return changed
  }

  private prepareSwooleCliProject(item: ProjectItem): boolean {
    if (this.flagType !== 'swoole-cli' || !item.path) {
      return false
    }
    const old = JSON.stringify({
      commandType: item.commandType,
      runCommand: item.runCommand,
      swooleCliPreset: item.swooleCliPreset,
      swooleCliScriptPath: item.swooleCliScriptPath
    })
    const swooleItem = item as SwooleCliProjectItem
    swooleItem.swooleCliPreset = inferSwooleCliPreset(swooleItem)
    const preset = swooleItem.swooleCliPreset || 'native'
    if (['native', 'php-script'].includes(preset) && !swooleItem.swooleCliScriptPath) {
      swooleItem.swooleCliScriptPath = defaultSwooleCliScriptPath(item.path)
    }
    item.commandType = 'command'
    if (preset !== 'custom') {
      item.runCommand = swooleCliPresetCommand(
        preset,
        item.path,
        item.projectPort || 3000,
        swooleItem.swooleCliScriptPath
      )
    }
    return (
      JSON.stringify({
        commandType: item.commandType,
        runCommand: item.runCommand,
        swooleCliPreset: item.swooleCliPreset,
        swooleCliScriptPath: item.swooleCliScriptPath
      }) !== old
    )
  }

  prepareProject(item: ProjectItem): boolean {
    return this.prepareRoadRunnerProject(item) || this.prepareSwooleCliProject(item)
  }

  private async syncRoadRunnerConfigPort(item: ProjectItem) {
    if (this.flagType !== 'roadrunner' || !item.path) {
      return
    }
    const rrItem = item as RoadRunnerProjectItem
    const configFile = roadRunnerPrimaryConfigPath(rrItem)
    if (!configFile || !(await fs.existsSync(configFile))) {
      return
    }
    const content = await fs.readFile(configFile)
    const next = updateRoadRunnerConfigPort(content, item.projectPort || 3000)
    if (next !== content) {
      await fs.writeFile(configFile, next)
    }
  }

  private projectEditComponent() {
    if (this.flagType === 'roadrunner') {
      return import('@/components/RoadRunner/ProjectEdit.vue')
    }
    if (this.flagType === 'swoole-cli') {
      return import('@/components/SwooleCli/ProjectEdit.vue')
    }
    return import('./ProjectEdit.vue')
  }

  private commitEdit(item: ProjectItem, draft: Partial<ProjectItem>, fullEdit: boolean) {
    const id = item.id
    const pending = this.edits.get(id)
    if (pending) return pending
    const { _state, isSorting, ...snapshot } = JSON.parse(JSON.stringify(draft))
    const operation = Promise.resolve()
      .then(async () => {
        if (!this.project.includes(item) || item.state.running) return
        const runtimeChanged = item.binBin !== snapshot.binBin
        const restart =
          item.state.isRun &&
          (fullEdit || runtimeChanged || item.projectPort !== snapshot.projectPort)
        if (restart && !(await item.stop())) return

        Object.assign(item, snapshot)
        this.prepareProject(item)
        if (!(await this.saveProject())) return
        if (
          fullEdit ||
          runtimeChanged ||
          this.flagType === 'roadrunner' ||
          this.flagType === 'swoole-cli'
        ) {
          if (!(await this.setDirEnv(item))) {
            MessageError(I18nT('base.fail'))
            return
          }
        }
        if (restart) await item.start()
      })
      .catch((error) => {
        MessageError(String(error))
      })
      .finally(() => {
        this.edits.delete(id)
      })
    this.edits.set(id, operation)
    return operation
  }

  quickEdit(
    item: ProjectItem,
    draft: Pick<ProjectItem, 'binBin' | 'binPath' | 'binVersion' | 'projectPort' | 'comment'>
  ) {
    return this.commitEdit(item, draft, false)
  }

  action(
    item: ProjectItem,
    index: number,
    action: 'open' | 'edit' | 'log' | 'config',
    showDialog: typeof AsyncComponentShow = AsyncComponentShow
  ) {
    switch (action) {
      case 'open':
        shell.openPath(item.path).catch()
        break
      case 'edit':
        return this.projectEditComponent()
          .then(({ default: component }) =>
            showDialog(component, {
              isEdit: true,
              edit: item,
              typeFlag: this.flagType
            })
          )
          .then((draft: ProjectItem | undefined) =>
            draft ? this.commitEdit(item, draft, true) : undefined
          )
          .catch((error) => {
            MessageError(String(error))
          })
      case 'log':
        import('./LogViewer.vue').then((res) => {
          showDialog(res.default, {
            item
          }).catch()
        })
        break
      case 'config':
        import('./ConfigViewer.vue').then((res) => {
          showDialog(res.default, {
            item
          }).catch()
        })
        break
    }
    return undefined
  }

  saveProject() {
    this.revision++
    const snapshot = this.project.map((item) => {
      const { _state, isSorting, ...saved } = JSON.parse(JSON.stringify(item))
      return saved
    })
    const saved = this.pendingSave
      .then(async () => {
        await localForage.setItem(`qtenvdev-${this.flagType}-projects`, snapshot)
        return true
      })
      .catch((error) => {
        MessageError(String(error))
        return false
      })
    this.pendingSave = saved.then(() => {})
    return saved
  }
  fetchProject(): Promise<void> {
    if (this.fetching) {
      return this.fetchProjectPromise ?? Promise.resolve()
    }
    this.fetching = true
    const revision = this.revision
    this.fetchProjectPromise = this.pendingSave
      .then(() => localForage.getItem<ProjectItem[]>(`qtenvdev-${this.flagType}-projects`))
      .then((res) => {
        if (revision !== this.revision) return
        if (res) {
          if (!Array.isArray(res)) throw new Error('Invalid saved project list')
          const existing = new Map(this.project.map((item) => [item.id, item]))
          const rows: ProjectItem[] = []
          let needSave = false
          for (const i of res) {
            const current = existing.get(i.id)
            existing.delete(i.id)
            if (current?.state.running || current?.state.isRun) {
              rows.push(current)
              continue
            }
            const incoming = new ProjectItem({ ...i, typeFlag: this.flagType })
            const item = current ?? reactiveBind(incoming)
            if (current) Object.assign(current, { ...incoming, _state: current.state })
            needSave = this.prepareProject(item) || needSave
            rows.push(item)
          }
          // The live process still needs its original owner even if storage no longer lists it.
          rows.push(
            ...[...existing.values()].filter((item) => item.state.running || item.state.isRun)
          )
          this.project.splice(0, this.project.length, ...rows)
          if (needSave) {
            this.saveProject()
          }
        }
        this.fetched = true
      })
      .catch(() => {
        this.fetched = false
      })
      .finally(() => {
        this.fetching = false
        this.fetchProjectPromise = undefined
      })
    return this.fetchProjectPromise
  }
  addProject(showDialog: typeof AsyncComponentShow = AsyncComponentShow) {
    const setupStore = SetupStore()
    const isLock = !setupStore.isActive && this.project.length > 2
    if (isLock) {
      MessageError(I18nT('host.licenseTips'))
      return
    }
    this.projectEditComponent().then((res) => {
      showDialog(res.default, {
        isEdit: false,
        edit: {},
        typeFlag: this.flagType
      }).then(async (res: ProjectItem) => {
        if (res) {
          const item = reactiveBind(new ProjectItem({ ...res, typeFlag: this.flagType }))
          this.prepareProject(item)
          const ready = await this.setDirEnv(item).catch(() => false)
          if (!ready) return
          this.project.unshift(item)
          this.saveProject()
        }
      })
    })
  }
  async initDirs(): Promise<boolean> {
    if (!(await ensureDataDirectoryReady())) {
      return false
    }
    let dirs: string[] | null
    try {
      dirs = await localForage.getItem<string[]>('qtenvdev-projects-dirs')
    } catch {
      this.allDirs = []
      return false
    }
    if (!dirs) return true
    this.allDirs = dirs
    const serialized = window.Server.isWindows ? JSON.stringify(dirs) : dirs.join('\n')
    try {
      await ShellInitController.syncAllowedDirs(serialized)
      return true
    } catch {
      return false
    }
  }
  saveDirs(): Promise<any> {
    return localForage.setItem('qtenvdev-projects-dirs', JSON.parse(JSON.stringify(this.allDirs)))
  }
  delProject(index: number) {
    const item = this.project[index]
    if (!item) return
    Base._Confirm(I18nT('base.delAlertContent'), undefined, {
      customClass: 'confirm-del',
      type: 'warning'
    })
      .then(() => {
        item
          .stop()
          .then((stopped) => {
            // PID 未确认停止时保留项目行、目录授权和重试入口。
            if (stopped !== true) return
            const currentIndex = this.project.indexOf(item)
            if (currentIndex < 0) return
            this.project.splice(currentIndex, 1)
            this.saveProject()
            const dirIndex = this.allDirs.indexOf(item.path)
            if (dirIndex >= 0) {
              this.allDirs.splice(dirIndex, 1)
            }
            this.saveDirs().then(() => {
              this.initDirs()
            })
          })
          .catch((error) => MessageError(String(error)))
      })
      .catch(() => {})
  }
  async setDirEnv(item: ProjectItem) {
    const timings: Record<string, number> = {}
    const startedAt = performanceDiagnosticNow()
    const context = { module: this.flagType, projectId: item.id }
    let currentStep = 'ensure-data-directory-ready'
    try {
      const dataDirectoryReady = await measureSetDirEnvStep(timings, context, currentStep, () =>
        ensureDataDirectoryReady()
      )
      if (!dataDirectoryReady) {
        logSetDirEnvTiming({
          event: 'completed',
          ...context,
          status: 'data-directory-not-ready',
          totalMs: performanceDiagnosticElapsed(startedAt),
          timings
        })
        return false
      }

      currentStep = 'sync-roadrunner-config-port'
      await measureSetDirEnvStep(timings, context, currentStep, () =>
        this.syncRoadRunnerConfigPort(item)
      )
      currentStep = 'write-project-env-file'
      await measureSetDirEnvStep(timings, context, currentStep, async () => {
        if (window.Server.isWindows) {
          try {
            const envFile = join(item.path, '.qtenvdev')
            const exists = await fs.existsSync(envFile)
            if (!exists) {
              if (!item.binVersion) {
                await fs.writeFile(envFile, '')
              } else {
                const arr: string[] = []
                const list = [item.binPath, join(item.binPath, 'bin'), join(item.binPath, 'sbin')]
                for (const s of list) {
                  const e = await fs.existsSync(s)
                  if (e) {
                    arr.push(s)
                  }
                }
                // 已选择的版本不存在时必须失败，不能写入空配置后声称版本已启用。
                if (!arr.length)
                  throw new Error('Selected project version directory is unavailable')
                if (arr.length) {
                  await fs.writeFile(
                    envFile,
                    `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n$env:PATH = ${windowsProjectPathLiteral(arr)} + $env:PATH #QTEnvDev-ID-${item.id}`
                  )
                }
              }
            } else {
              // 保留用户手写的 .qtenvdev 内容；读取失败不能当空文件再覆盖。
              const content = await fs.readFileStrict(envFile)
              const lines = content
                .trim()
                .split('\n')
                .filter((s: string) => {
                  const line = s.trim()
                  return !!line && !line.includes(`#QTEnvDev-ID-${item.id}`)
                })
              if (item.binVersion) {
                const arr: string[] = []
                const list = [item.binPath, join(item.binPath, 'bin'), join(item.binPath, 'sbin')]
                for (const s of list) {
                  const e = await fs.existsSync(s)
                  if (e) {
                    arr.push(s)
                  }
                }
                // 更新现有配置也必须确认所选版本存在，失败时保留原文件内容。
                if (!arr.length)
                  throw new Error('Selected project version directory is unavailable')
                if (arr.length) {
                  lines.push(
                    `$env:PATH = ${windowsProjectPathLiteral(arr)} + $env:PATH #QTEnvDev-ID-${item.id}`
                  )
                }
              }
              await fs.writeFile(envFile, lines.join('\n'))
            }
          } catch (e: any) {
            MessageError(e.toString())
            // 写入失败/取消必须结束项目版本设置，不能继续注册目录并返回 ready。
            throw e
          }
        } else {
          try {
            const envFile = join(item.path, '.qtenvdev')
            const exists = await fs.existsSync(envFile)
            if (!exists) {
              if (!item.binVersion) {
                await fs.writeFile(envFile, '')
              } else {
                const arr: string[] = []
                const list = [item.binPath, join(item.binPath, 'bin'), join(item.binPath, 'sbin')]
                for (const s of list) {
                  const e = await fs.existsSync(s)
                  if (e) {
                    arr.push(s)
                  }
                }
                if (arr.length) {
                  await fs.writeFile(
                    envFile,
                    `#!/bin/zsh\nexport PATH="${arr.join(':')}:$PATH" #QTEnvDev-ID-${item.id}`
                  )
                }
              }
            } else {
              const content = await fs.readFile(envFile)
              const lines = content
                .trim()
                .split('\n')
                .filter((s: string) => {
                  const line = s.trim()
                  return !!line && !line.includes(`#QTEnvDev-ID-${item.id}`)
                })
              if (item.binVersion) {
                const arr: string[] = []
                const list = [item.binPath, join(item.binPath, 'bin'), join(item.binPath, 'sbin')]
                for (const s of list) {
                  const e = await fs.existsSync(s)
                  if (e) {
                    arr.push(s)
                  }
                }
                if (arr.length) {
                  lines.push(`export PATH="${arr.join(':')}:$PATH" #QTEnvDev-ID-${item.id}`)
                }
              }
              await fs.writeFile(envFile, lines.join('\n'))
            }
          } catch (e: any) {
            MessageError(e.toString())
          }
        }
      })
      const wasExistingDir = this.allDirs.includes(item.path)
      if (!wasExistingDir) {
        this.allDirs.push(item.path)
      }
      currentStep = 'save-project-directories'
      await measureSetDirEnvStep(timings, context, currentStep, () => this.saveDirs())
      currentStep = 'initialize-project-directories'
      const dirsInitialized = await measureSetDirEnvStep(timings, context, currentStep, () =>
        this.initDirs()
      )
      let shellInitialized = false
      if (dirsInitialized) {
        currentStep = 'initialize-shell-hook'
        shellInitialized = !!(await measureSetDirEnvStep(timings, context, currentStep, () =>
          ShellInitController.ensure()
        ))
      }
      if (!dirsInitialized || !shellInitialized) {
        if (!wasExistingDir) {
          const dirIndex = this.allDirs.lastIndexOf(item.path)
          if (dirIndex >= 0) {
            this.allDirs.splice(dirIndex, 1)
          }
          await this.saveDirs()
          await this.initDirs()
        }
        logSetDirEnvTiming({
          event: 'completed',
          ...context,
          status: dirsInitialized ? 'shell-not-initialized' : 'directories-not-initialized',
          totalMs: performanceDiagnosticElapsed(startedAt),
          timings
        })
        return false
      }
      logSetDirEnvTiming({
        event: 'completed',
        ...context,
        status: 'ready',
        totalMs: performanceDiagnosticElapsed(startedAt),
        timings
      })
      return true
    } catch (error) {
      logSetDirEnvTiming({
        event: 'failed',
        ...context,
        step: currentStep,
        totalMs: performanceDiagnosticElapsed(startedAt),
        timings,
        error: error instanceof Error ? error.message : `${error}`
      })
      throw error
    }
  }
  stopAll(): Promise<boolean[]> {
    return Promise.all(this.project.map((p) => p.stop()))
  }
  startAll(): Promise<Array<string | boolean>> {
    return Promise.all(this.project.map((p) => p.start()))
  }
}
