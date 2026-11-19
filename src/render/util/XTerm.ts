import '@xterm/xterm/css/xterm.css'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import IPC from './IPC'
import { AppStore } from '@/store/app'
import { nativeTheme, clipboard } from '@/util/NodeFn'

interface XTermType {
  xterm: Terminal | undefined
  dom: HTMLElement | undefined
}

type ResolveFn = (...args: any) => void

export class TerminalExitError extends Error {
  constructor(
    message: string,
    readonly exitCode?: number
  ) {
    super(message)
  }
}

export class XTerm implements XTermType {
  xterm: Terminal | undefined
  dom: HTMLElement | undefined
  fitaddon: FitAddon | undefined
  logs: Array<string> = []
  ptyKey: string = ''
  end = false
  resized = false
  private resolve: ResolveFn | undefined = undefined
  private executionKey?: string
  private initialization?: Promise<void>
  private mountToken?: object

  constructor() {}

  initialize(): Promise<void> {
    if (this.ptyKey) return Promise.resolve()
    if (this.initialization) return this.initialization
    this.initialization = new Promise<void>((resolve, reject) => {
      IPC.send('NodePty:init').then((key: string, res: any) => {
        if (res?.code === 200) return
        IPC.off(key)
        if (res?.code !== 0 || !res?.data) {
          reject(new Error(res?.msg ?? 'Failed to initialize terminal'))
          return
        }
        this.ptyKey = res.data
        IPC.on(`NodePty:data:${this.ptyKey}`).then((_key: string, data: string) => {
          this.write(data)
          this.xterm?.focus?.()
        })
        resolve()
      })
    }).finally(() => {
      this.initialization = undefined
    })
    return this.initialization
  }

  async mount(dom: HTMLElement) {
    this.unmounted()
    this.dom = dom
    const mountToken = {}
    this.mountToken = mountToken
    await this.initialize()
    const appStore = AppStore()
    const theme: { [k: string]: string } = {}
    let appTheme = ''
    if (!appStore?.config?.setup?.theme || appStore?.config?.setup?.theme === 'system') {
      const isDark = await nativeTheme.shouldUseDarkColors()
      appTheme = isDark ? 'dark' : 'light'
    } else {
      appTheme = appStore?.config?.setup?.theme
    }
    if (this.mountToken !== mountToken) return
    if (appTheme === 'light') {
      theme.background = '#ffffff'
      theme.foreground = '#334455'
      theme.selectionBackground = '#a0cfff'
      theme.cursor = '#666666'
    } else {
      theme.background = '#282b3d'
      theme.foreground = '#cfd3dc'
      theme.selectionBackground = '#606266'
      theme.cursor = '#dddddd'
    }
    this.xterm = new Terminal({
      fontSize: 14,
      fontFamily: appStore.config.setup?.codeFont || 'Menlo, Monaco, "Courier New", monospace',
      letterSpacing: 0, // 消除字体渲染差异
      lineHeight: 1.2, // 统一行高

      // 其他
      allowTransparency: false, // 禁用透明避免差异

      cursorBlink: true,
      allowProposedApi: true,
      cursorWidth: 8,
      cursorStyle: 'bar',
      logLevel: 'off',
      theme: theme
    })

    let webglAddon: WebglAddon | undefined
    try {
      webglAddon = new WebglAddon()
      this.xterm.loadAddon(webglAddon)
    } catch {}
    webglAddon?.onContextLoss?.(() => {
      webglAddon?.dispose?.()
    })

    const fitaddon = new FitAddon()
    this.xterm.loadAddon(fitaddon)
    this.xterm.open(dom)
    fitaddon.fit()
    const cols = this.xterm.cols
    const rows = this.xterm.rows
    IPC.send('NodePty:resize', this.ptyKey, { cols, rows }).then((key: string) => IPC.off(key))
    this.fitaddon = fitaddon
    this.initEvent()
    this.xterm.focus()
    this.initLog()
    this.xterm?.write('\x1b[?25h')
    return true
  }

  initEvent() {
    this.xterm!.attachCustomKeyEventHandler((arg) => {
      if (arg.ctrlKey && arg.code === 'KeyC' && arg.type === 'keydown') {
        const selection = this.xterm!.getSelection()
        if (selection) {
          clipboard.writeText(selection)
          return false
        }
      }
      return true
    })
    this.xterm!.onData((data) => {
      if (this.end) {
        return
      }
      const request = IPC.sendSensitive('NodePty:write', this.ptyKey, data)
      // Keyboard writes have no main-process acknowledgement.
      IPC.off(request.key)
    })
    /**
     * Reset the interface size
     */
    this.onWindowResit = this.onWindowResit.bind(this)
    window.addEventListener('resize', this.onWindowResit)
  }

  initLog() {
    console.log('initLog: ', this.logs)
    if (this.logs.length > 0) {
      for (const log of this.logs) {
        this.xterm?.write(log)
      }
    }
  }

  writeToNodePty(data: string) {
    const request = IPC.sendSensitive('NodePty:write', this.ptyKey, data)
    IPC.off(request.key)
  }

  write(data: string) {
    if (!this.xterm) {
      console.log('not xterm !!!!!!')
    }
    this.xterm?.write(data)
    if (!this.resized) {
      this.resized = true
      this.onWindowResit()
    }
    if (
      data.startsWith(`\r`) ||
      data.endsWith(`\u001b[K`) ||
      data.endsWith(`\x1B[K`) ||
      data.endsWith(`\\u001b[K`) ||
      data.endsWith(`\\x1B[K`) ||
      data.endsWith(`\x1B[K\x1B[13C`) ||
      data.endsWith(`\u001b[K\u001b[13C`) ||
      data.endsWith(`\\x1B[K\\x1B[13C`) ||
      data.endsWith(`\\u001b[K\\u001b[13C`)
    ) {
      console.log('logs pop !!!!!!!!!!!!!!@@@@@@@@@@@@@@')
      this.logs.pop()
    }
    if (this.logs.length > 100) {
      this.logs.shift()
    }
    this.logs.push(data)
  }

  onWindowResit() {
    if (this.xterm) {
      this.fitaddon?.fit()
      const cols = this.xterm.cols
      const rows = this.xterm.rows
      IPC.send('NodePty:resize', this.ptyKey, { cols, rows }).then((key: string) => IPC.off(key))
    }
  }

  cleanLog() {
    this.logs.splice(0)
  }

  destroy() {
    this.releaseExecution()
    this.releaseProcessOutput()
    this.unmounted()
    this.cleanLog()
  }

  unmounted() {
    this.mountToken = undefined
    window.removeEventListener('resize', this.onWindowResit)
    try {
      this.fitaddon?.dispose()
      this.xterm?.dispose()
    } catch {
      /* empty */
    }
    this.xterm = undefined
    this.fitaddon = undefined
    this.dom = undefined
  }

  releaseProcessOutput() {
    if (this.ptyKey) IPC.off(`NodePty:data:${this.ptyKey}`)
  }

  stop() {
    return new Promise((resolve, reject) => {
      IPC.send('NodePty:stop', this.ptyKey).then((key: string, res: any) => {
        if (res?.code === 200) return
        IPC.off(key)
        if (res?.code === 1) {
          reject(new Error(res?.msg ?? 'Failed to stop terminal'))
          return
        }
        this.end = true
        this.releaseExecution()
        this?.resolve?.(true)
        this.resolve = undefined
        resolve(true)
      })
    })
  }

  private releaseExecution() {
    if (this.executionKey) IPC.off(this.executionKey)
    this.executionKey = undefined
  }

  send(command: string[], execUseOneFile: boolean | 'direct' = true, reportExitCode = false) {
    console.log('XTerm send:', command)
    if (this.end) {
      return
    }
    return new Promise((resolve, reject) => {
      this.resolve = resolve
      const param = [...command]
      if (execUseOneFile === true) {
        if (window.Server.isWindows) {
          param.push(`echo "Task-${this.ptyKey}-End"`)
          param.push(`exit 0`)
        } else {
          if (reportExitCode) param.push('qtenvdev_terminal_exit_code=$?')
          param.push(`wait;`)
          param.push(
            reportExitCode
              ? `echo "Task-${this.ptyKey}-END"; exit "$qtenvdev_terminal_exit_code";`
              : `echo "Task-${this.ptyKey}-END" && exit 0;`
          )
        }
      }
      const request = IPC.send('NodePty:exec', this.ptyKey, param, execUseOneFile, reportExitCode)
      this.executionKey = request.key
      request.then((key: string, res: any) => {
        if (res?.code === 200) return
        console.log('static command finished: ', command)
        IPC.off(key)
        if (this.executionKey === key) this.executionKey = undefined
        this.end = true
        this.resolve = undefined
        if (reportExitCode && (res?.code !== 0 || res?.data?.exitCode !== 0)) {
          reject(
            new TerminalExitError(
              res?.msg ?? 'The terminal did not confirm success',
              res?.data?.exitCode
            )
          )
          return
        }
        if (res?.code === 1) {
          reject(new Error(res?.msg ?? 'Failed to execute terminal command'))
          return
        }
        resolve(true)
      })
    })
  }
}

export default XTerm
