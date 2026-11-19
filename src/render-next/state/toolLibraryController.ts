import { reactiveBind, uuid } from '@/util/Index'
import { StorageGetAsync, StorageSetAsync } from '@/util/Storage'
import { fs, shell } from '@/util/NodeFn'
import { join } from '@/util/path-browserify'
import { ToolLibraryController } from './ToolLibraryModel'
import { toolController } from './toolController'
export type { CustomTool } from './ToolLibraryModel'
export { customToolUrl } from './ToolLibraryModel'

export const toolLibraryController = reactiveBind(new ToolLibraryController({
  load: () => StorageGetAsync('pqt-forge-tool-library'),
  save: (data) => StorageSetAsync('pqt-forge-tool-library', data),
  async readLegacy() {
    if (!window.Server?.BaseDir) return undefined
    const path = join(window.Server.BaseDir, 'app.tools.json')
    if (!await fs.existsSync(path)) return undefined
    return JSON.parse(await fs.readFile(path))
  },
  id: uuid,
  aliases: toolController.tools.map((tool) => tool.id),
  openExternal: (url) => shell.openExternal(url)
}))
