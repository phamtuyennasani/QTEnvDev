import { reactive } from 'vue'
import localForage from 'localforage'

export const MeiliSearchSetup: {
  dir: Record<string, string>
  init: () => void
  save: () => void
} = reactive({
  dir: {},
  init() {
    localForage
      .getItem('qtenvdev-meilisearch-storage-dir')
      .then((res: Record<string, string>) => {
        if (res) {
          MeiliSearchSetup.dir = reactive(res)
        }
      })
      .catch()
  },
  save() {
    localForage
      .setItem('qtenvdev-meilisearch-storage-dir', JSON.parse(JSON.stringify(MeiliSearchSetup.dir)))
      .then()
      .catch()
  }
})
