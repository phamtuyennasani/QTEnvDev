import { reactive, ref } from 'vue'
import { MysqlStore } from '@/components/Mysql/mysql'
import { BrewStore } from '@/store/brew'
import { showNotice } from './app'
import type { MysqlGroupItem } from '@shared/app'
import { ServiceFilesController } from './serviceFilesController'

const loading = ref(false)
const catalogBusy = ref(false)
const error = ref('')
const logs = reactive(new ServiceFilesController())

async function load() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const groupStore = MysqlStore()
    const versionStore = BrewStore().module('mysql')
    const [catalog, versions] = await Promise.allSettled([groupStore.init(), versionStore.fetchInstalled()])
    if (catalog.status === 'rejected') throw catalog.reason
    if (versions.status === 'rejected' || !versions.value) error.value = 'Could not load installed MySQL versions.'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    loading.value = false
  }
}

async function run(action: 'start' | 'stop', item?: MysqlGroupItem) {
  if (catalogBusy.value) return
  const store = MysqlStore()
  const result = await (item ? store[action](item) : action === 'start' ? store.groupStart() : store.groupStop())
  showNotice(result === true ? `MySQL ${item ? 'instance group' : 'instance groups'} ${action === 'start' ? 'started' : 'stopped'}.` : result)
}

async function change(item: MysqlGroupItem, remove = false) {
  if (catalogBusy.value) return false
  catalogBusy.value = true
  try {
    const store = MysqlStore()
    if (remove) {
      await store.removeGroup(item)
      showNotice('MySQL instance group removed.')
    } else {
      const result = await store.updateGroup(item)
      showNotice(result.warning ? `Group saved. MySQL could not restart: ${result.warning}` : 'MySQL instance group saved.')
    }
    return true
  } catch (reason) {
    showNotice(reason instanceof Error ? reason.message : String(reason))
    return false
  } finally {
    catalogBusy.value = false
  }
}

export const mysqlGroupController = { loading, catalogBusy, error, logs, load, run, change }
