import { reactiveBind } from '@/util/Index'
import { dialog } from '@/util/NodeFn'
import { showNotice } from '../state/app'

class ConfigurationPathPicker {
  choosing = false

  async choose(
    name: string,
    directory: boolean,
    defaultPath: string,
    isCurrent: () => boolean,
    apply: (path: string) => void
  ) {
    if (this.choosing) return
    this.choosing = true
    try {
      const result = await dialog.showOpenDialog({
        title: 'Choose a path for ' + name,
        properties: directory
          ? ['openDirectory', 'createDirectory', 'showHiddenFiles']
          : ['openFile', 'showHiddenFiles'],
        ...(defaultPath ? { defaultPath } : {})
      })
      const path = result.filePaths?.[0]
      if (isCurrent() && !result.canceled && path) apply(path)
    } catch {
      if (isCurrent()) showNotice('The path picker could not open.')
    } finally {
      this.choosing = false
    }
  }
}

export const configurationPathPicker = reactiveBind(new ConfigurationPathPicker())
