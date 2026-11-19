import { reactiveBind } from '@/util/Index'
import { StorageGetAsync, StorageSetAsync } from '@/util/Storage'
export type CustomTool = { id: string; label: string; component: string }
type ToolLibraryData = { favorites: string[]; custom: CustomTool[] }
const key = 'pqt-forge-tool-library'
class ToolLibraryController {
  favorites: string[] = []; custom: CustomTool[] = []; ready = false
  async init() { if (this.ready) return; const saved = await StorageGetAsync<ToolLibraryData>(key); this.favorites = Array.isArray(saved?.favorites) ? saved!.favorites : []; this.custom = Array.isArray(saved?.custom) ? saved!.custom : []; this.ready = true }
  private persist() { return StorageSetAsync(key, { favorites: this.favorites, custom: this.custom }) }
  isFavorite(id: string) { return this.favorites.includes(id) }
  async toggleFavorite(id: string) { this.favorites = this.isFavorite(id) ? this.favorites.filter((item) => item !== id) : [...this.favorites, id]; await this.persist() }
  async addCustom(label: string, component: string) { const cleanLabel = label.trim(); const cleanComponent = component.trim(); if (!cleanLabel || !cleanComponent) throw new Error('Label and component are required'); this.custom = [{ id: 'custom-' + Date.now(), label: cleanLabel, component: cleanComponent }, ...this.custom]; await this.persist() }
  async removeCustom(id: string) { this.custom = this.custom.filter((item) => item.id !== id); this.favorites = this.favorites.filter((item) => item !== id); await this.persist() }
}
export const toolLibraryController = reactiveBind(new ToolLibraryController())
