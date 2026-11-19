import { MessageError, MessageSuccess } from '@/util/Element'
import { I18nT } from '@lang/index'
import { clipboard } from '@/util/NodeFn'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'

export const Project = {
  copyPath(dir: string) {
    clipboard.writeText(dir)
    MessageSuccess(I18nT('base.copySuccess'))
  },
  async openPath(
    dir: string,
    flag:
      | 'PowerShell'
      | 'PowerShell7'
      | 'Terminal'
      | 'VSCode'
      | 'Sublime'
      | 'PhpStorm'
      | 'WebStorm'
      | 'HBuilderX'
      | 'GoLand'
      | 'IntelliJ'
      | 'PyCharm'
      | 'RubyMine'
      | 'RustRover',
    reportError = true
  ): Promise<true | string> {
    try {
      const result = await forkTerminalRequest(
        'app-fork:tools',
        ['openPathByApp', dir, flag],
        'The application launch did not return a result.',
        60_000
      )
      if (result.code === 0 && result.data === true) return true
      throw new Error(result.msg || 'The application could not be opened.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (reportError) MessageError(message)
      return message
    }
  }
}
