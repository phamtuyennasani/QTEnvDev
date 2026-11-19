import { AppCustomerModule, createCustomerModule } from '@/core/Module'
import type { CustomerModuleCateItem, CustomerModuleItem } from '@/core/Module'
import type { ModuleCustomer, ModuleCustomerExecItem } from '@/core/ModuleCustomer'
import { reactiveBind, uuid } from '@/util/Index'
import { showNotice } from '../state/app'

type ServiceAction = 'start' | 'stop' | 'restart'

export class CustomModulesController {
  ready = false
  pending = ''
  error = ''

  get modules() { return AppCustomerModule.module }
  get groups() { return AppCustomerModule.moduleCate }

  load() {
    if (this.ready) return Promise.resolve(true)
    return this.run('Loading custom modules', async () => {
      await AppCustomerModule.init()
      this.ready = true
    })
  }

  save(draft: CustomerModuleItem, previous?: ModuleCustomer) {
    return this.run('Saving custom module', async () => {
      const label = draft.label.trim()
      if (!label) throw new Error('Enter a module name.')
      if (previous) this.requireModule(previous)
      if (draft.moduleType && !this.groups.some(group => group.moduleType === draft.moduleType) && draft.moduleType !== previous?.moduleType) {
        throw new Error('This category no longer exists. Select a different category.')
      }
      if (!previous && this.modules.some(module => module.id === draft.id)) {
        throw new Error('A module with this ID already exists.')
      }
      const currentId = previous?.currentItemID
      const saved = createCustomerModule({ ...draft, label })
      saved.currentItemID = currentId && saved.item.some(item => item.id === currentId) ? currentId : ''
      const replaced = previous
        ? this.modules.map(module => module === previous ? saved : module)
        : [saved, ...this.modules]
      await this.writeModules(replaced, previous)
      if (previous && AppCustomerModule.currentModule === previous) AppCustomerModule.currentModule = saved
      this.updateVisibilityWatch(() => saved.watchShowHide())
    }, 'Custom module saved.')
  }

  remove(module: ModuleCustomer) {
    return this.run('Removing custom module', async () => {
      this.requireModule(module)
      await this.writeModules(this.modules.filter(entry => entry !== module), module)
      if (AppCustomerModule.currentModule === module) AppCustomerModule.currentModule = undefined
    }, 'Custom module removed.')
  }

  saveGroup(label: string, previous?: CustomerModuleCateItem) {
    return this.run('Saving category', async () => {
      if (previous) this.requireGroup(previous)
      const name = label.trim()
      if (!name) throw new Error('Enter a category name.')
      const id = previous?.id ?? uuid()
      const saved = { id, label: name, moduleType: previous?.moduleType ?? id }
      const categories = previous
        ? this.groups.map(group => group === previous ? saved : group)
        : [saved, ...this.groups]
      await AppCustomerModule.saveModuleCate(categories)
      AppCustomerModule.moduleCate = categories
    }, 'Category saved.')
  }

  removeGroup(group: CustomerModuleCateItem) {
    return this.run('Removing category', async () => {
      this.requireGroup(group)
      if (this.modules.some(module => module.moduleType === group.moduleType)) {
        throw new Error('Move the modules to another category before removing this category.')
      }
      const categories = this.groups.filter(entry => entry !== group)
      await AppCustomerModule.saveModuleCate(categories)
      AppCustomerModule.moduleCate = categories
    }, 'Category removed.')
  }

  service(module: ModuleCustomer, item: ModuleCustomerExecItem, action: ServiceAction) {
    return this.run(`${action === 'stop' ? 'Stopping' : action === 'restart' ? 'Restarting' : 'Starting'} ${item.name}`, async () => {
      this.requireModule(module)
      if (!module.item.includes(item)) throw new Error('This command changed. Select it again.')
      const result = await item[action]()
      if (result !== true) throw new Error(typeof result === 'string' ? result : 'The command did not complete.')
    }, action === 'stop' ? 'Command stopped.' : module.isService ? `Service ${action === 'restart' ? 'restarted' : 'started'}.` : 'Command completed.')
  }

  private requireModule(module: ModuleCustomer) {
    if (!this.modules.includes(module)) throw new Error('This module changed. Open the current definition and try again.')
  }

  private requireGroup(group: CustomerModuleCateItem) {
    if (!this.groups.includes(group)) throw new Error('This category changed. Select it again.')
  }

  private async writeModules(next: ModuleCustomer[], previous?: ModuleCustomer) {
    const write = async () => {
      const active = previous?.item.filter(item => item.run || item.running) ?? []
      if (previous) {
        const stopped = await previous.stop()
        if (stopped !== true) {
          const completed = active.filter(item => !item.run && !item.running && !item.startOutcomeUnknown)
          const partial = completed.length ? ` Already stopped: ${completed.map(item => item.name).join(', ')}.` : ''
          throw new Error(`The module was kept because a command could not be stopped. ${String(stopped)}${partial}`)
        }
      }
      try {
        await AppCustomerModule.saveModule(next)
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        const partial = active.length ? ` Stopped commands: ${active.map(item => item.name).join(', ')}.` : ''
        throw new Error(`The saved definitions were kept. ${detail}${partial}`)
      }
      AppCustomerModule.module = next
      AppCustomerModule.index += 1
      this.updateVisibilityWatch(() => previous?.showHideWatcher?.())
    }
    return previous ? previous.changeDefinition(write) : write()
  }

  private updateVisibilityWatch(update: () => void) {
    try {
      update()
    } catch (error) {
      console.error('Could not update the custom module visibility watcher.', error)
    }
  }

  private async run(label: string, operation: () => Promise<void>, notice?: string) {
    if (this.pending || (!this.ready && notice)) return false
    this.pending = label
    this.error = ''
    try {
      await operation()
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      return false
    } finally {
      this.pending = ''
    }
    if (notice) showNotice(notice)
    return true
  }
}

export const customModulesController = reactiveBind(new CustomModulesController())
