import { CloudflareTunnel } from '@/core/CloudflareTunnel/CloudflareTunnel'
import { StorageGetAsync, StorageSetAsync } from '@/util/Storage'
import { reactiveBind } from '@/util/Index'

const storeKey = 'qtenvdev-cloudflare-tunnel-store'

class CloudflareTunnelStore {
  items: CloudflareTunnel[] = []
  inited: boolean = false
  loadError = ''
  private loading?: Promise<void>

  init(): Promise<void> {
    if (this.inited) return Promise.resolve()
    if (this.loading) return this.loading
    this.loadError = ''
    this.loading = StorageGetAsync<CloudflareTunnel[]>(storeKey)
      .then((saved) => {
        const items = (saved ?? []).map((item) => reactiveBind(new CloudflareTunnel(item)))
        this.items.push(...items)
        this.inited = true
      })
      .catch((error) => {
        this.loadError = error instanceof Error ? error.message : String(error)
        throw error
      })
      .finally(() => {
        this.loading = undefined
      })
    return this.loading
  }

  save() {
    StorageSetAsync(storeKey, JSON.parse(JSON.stringify(this.items))).catch()
  }
}

export default reactiveBind(new CloudflareTunnelStore())
