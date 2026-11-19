import { I18nT } from '@lang/index'
import { ProjectItem } from '@/components/LanguageProjects/ProjectItem'
import { ProjectSetup } from '@/components/LanguageProjects/setup'
import { BrewStore } from '@/store/brew'
import { reactiveBind } from '@/util/Index'
import { MessageError } from '@/util/Element'
import { FlutterAction, flutterRequest, flutterSetup } from './WorkbenchController'

type ProjectOptions = {
  name: string
  outputDir: string
  template: string
  orgName: string
  flutterBin: string
  addToProjects: boolean
  payload: Record<string, unknown>
}

class FlutterProjectController {
  write = new FlutterAction()
  private reads = new Map<string, Promise<any>>()

  read(method: string, ...args: unknown[]) {
    const key = JSON.stringify([method, ...args])
    const prior = this.reads.get(key)
    if (prior) return prior
    const pending = flutterRequest(method, args)
      .then((reply) => {
        if (reply.code !== 0) throw new Error(reply.msg || 'Flutter could not read the project.')
        return reply.data
      })
      .catch((error) => {
        MessageError(error instanceof Error ? error.message : String(error))
        return null
      })
      .finally(() => this.reads.delete(key))
    this.reads.set(key, pending)
    return pending
  }

  create(options: ProjectOptions) {
    const { name, outputDir, template, orgName, flutterBin, addToProjects, payload } = options
    const runtime = this.runtime(flutterBin)
    return this.write.run(
      'flutterCreateProject',
      [name, outputDir, template, orgName, flutterBin, flutterSetup(), payload],
      `${I18nT('flutter.creatingProject')} "${name}"…`,
      360_000,
      async (result) => {
        if (!addToProjects || !result.projectPath) return
        const store = ProjectSetup('flutter')
        await store.fetchProject()
        if (!store.fetched) throw new Error('The saved projects could not be loaded.')
        if (store.project.some((item) => item.path === result.projectPath)) return
        const item = reactiveBind(
          new ProjectItem({
            path: result.projectPath,
            comment: name,
            ...runtime,
            isService: false,
            typeFlag: 'flutter'
          })
        )
        store.project.unshift(item)
        if (!(await store.saveProject())) {
          const current = store.project.indexOf(item)
          if (current >= 0) store.project.splice(current, 1)
          throw new Error('The project could not be added to the saved list.')
        }
        const steps = await Promise.allSettled([
          store.setDirEnv(item),
          this.addDirectory(result.projectPath)
        ])
        if (steps.some((step) => step.status === 'rejected' || step.value === false))
          throw new Error('The saved project environment could not be refreshed.')
      }
    )
  }

  save(path: string, payload: Record<string, unknown>, flutterBin: string) {
    const runtime = this.runtime(flutterBin)
    return this.write.run(
      'flutterApplyProjectConfig',
      [path, payload, flutterSetup()],
      `${I18nT('flutter.applyingSettings')}…`,
      360_000,
      async () => {
        const store = ProjectSetup('flutter')
        const item = store.project.find((project) => project.path === path)
        if (!item) return
        const previous = { binBin: item.binBin, binVersion: item.binVersion, binPath: item.binPath }
        Object.assign(item, runtime)
        if (!(await store.saveProject())) {
          Object.assign(item, previous)
          throw new Error('The saved project runtime could not be updated.')
        }
        if (!(await store.setDirEnv(item)))
          throw new Error('The project environment could not be updated.')
      }
    )
  }

  private runtime(binBin: string) {
    const selected = BrewStore()
      .module('flutter')
      .installed.find((item) => item.bin === binBin)
    return { binBin, binVersion: selected?.version ?? '', binPath: selected?.path ?? '' }
  }

  private async addDirectory(path: string) {
    const store = ProjectSetup('flutter')
    if (store.allDirs.includes(path)) return true
    store.allDirs.push(path)
    await store.saveDirs()
    return store.initDirs()
  }
}

export const flutterProjects = reactiveBind(new FlutterProjectController())
