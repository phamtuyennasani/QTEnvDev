import { shallowRef, ref } from 'vue'
import { BrewStore } from '@/store/brew'
import type { ModuleInstalledItem } from '@/core/Module/ModuleInstalledItem'
import type { Component } from 'vue'
import { showNotice } from './app'
import { databaseController } from './databaseController'

type Engine = 'mysql' | 'mariadb'
const opening = ref(false)
const active = shallowRef<{ item: ModuleInstalledItem; component: Component }>()
let flight: Promise<void> | undefined

const open = (flag: Engine) => {
  if (flight || active.value) return flight
  opening.value = true
  flight = Promise.resolve()
    .then(async () => {
      const store = BrewStore()
      const module = store.module(flag)
      if (!(await module.fetchInstalled()))
        throw new Error('Could not load the installed database versions.')
      const item =
        module.installed.find((version) => version.run) ??
        store.currentVersion(flag) ??
        module.installed[0]
      if (!item?.version) throw new Error('Install a database version before opening Manage.')
      const [{ default: component }, { MySQLManage }] = await Promise.all([
        import('@/components/Mysql/Manage/index.vue'),
        import('@/components/Mysql/Manage/manage')
      ])
      await MySQLManage.ready(flag)
      active.value = { item, component }
    })
    .catch((error) => {
      showNotice(error instanceof Error ? error.message : String(error))
    })
    .finally(() => {
      opening.value = false
      flight = undefined
    })
  return flight
}

const close = () => {
  active.value = undefined
  void databaseController.refresh()
}

export const databaseManageController = { active, opening, open, close }
