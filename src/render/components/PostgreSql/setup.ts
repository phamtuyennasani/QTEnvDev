import { reactive } from 'vue'
import localForage from 'localforage'

let initPromise: Promise<void> | undefined
let directoryWrite: Promise<void> | undefined
const directoryKey = 'qtenvdev-postgresql-storage-dir'

export const PostgreSqlSetup: {
  dir: Record<string, string>
  init: () => Promise<void>
  settleWrite: () => Promise<void>
  setDirectory: (bin: string, path: string) => Promise<void>
} = reactive({
  dir: {},
  init() {
    if (initPromise) {
      return initPromise
    }
    initPromise = localForage
      .getItem<Record<string, string>>(directoryKey)
      .then((res) => {
        if (res) {
          PostgreSqlSetup.dir = reactive(res)
        }
      })
      .catch((error) => {
        initPromise = undefined
        throw error
      })
    return initPromise
  },
  async settleWrite() {
    await directoryWrite?.catch(() => undefined)
  },
  async setDirectory(bin: string, path: string) {
    await PostgreSqlSetup.init()
    if (directoryWrite) throw new Error('A PostgreSQL directory change is already being saved.')
    const snapshot = { ...PostgreSqlSetup.dir, [bin]: path }
    directoryWrite = localForage.setItem(directoryKey, snapshot).then(() => {
      PostgreSqlSetup.dir = snapshot
    })
    try {
      await directoryWrite
    } finally {
      directoryWrite = undefined
    }
  }
})
