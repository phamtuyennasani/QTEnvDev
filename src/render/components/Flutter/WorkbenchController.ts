import { reactiveBind } from '@/util/Index'
import { AppStore } from '@/store/app'
import { MessageError, MessageSuccess, MessageWarning } from '@/util/Element'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'

export const flutterSetup = () => JSON.parse(JSON.stringify(AppStore().config.setup))

export function flutterRequest(method: string, args: unknown[] = [], timeout = 90_000) {
  return forkTerminalRequest(
    'app-fork:flutter',
    [method, ...args],
    'Flutter did not report a result.',
    timeout,
    undefined,
    true
  )
}

type Check = { key: string; label: string; ok: boolean; value: string; hint: string }
type Device = { id: string; status: string; meta: string }
type DoctorItem = { status: 'ok' | 'warning' | 'error' | 'unknown'; title: string }

class FlutterRead<T> {
  loading = false
  error = ''
  constructor(public data: T) {}

  async refresh(method: string, args: unknown[] = []) {
    if (this.loading) return
    this.loading = true
    this.error = ''
    try {
      const reply = await flutterRequest(method, args)
      if (reply.code !== 0) throw new Error(reply.msg || 'Flutter could not complete the request.')
      this.data = reply.data ?? this.data
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
    } finally {
      this.loading = false
    }
  }
}

export class FlutterAction {
  running = false
  unknown = false
  action = ''
  output = ''

  async run(
    method: string,
    args: unknown[],
    label: string,
    timeout = 360_000,
    onCompleted?: (data: any) => Promise<void>
  ) {
    if (this.running || this.unknown) return
    this.running = true
    this.action = String(args[0] ?? method)
    this.output = label + '\n'
    try {
      const reply = await flutterRequest(method, args, timeout)
      const data = reply.data
      if (data?.output) this.output += data.output
      if (reply.code !== 0 || !data?.ok) {
        const details = data?.results
          ?.filter((item: { ok: boolean }) => !item.ok)
          .map((item: { message?: string }) => item.message)
          .filter(Boolean)
          .join('; ')
        const message = [reply.msg || data?.message || 'Flutter command failed.', details]
          .filter(Boolean)
          .join(' ')
        this.output += '\n' + message
        MessageError(message)
        return reply.code === 0 ? data : undefined
      }
      if (data.message) {
        this.output += '\n' + data.message
        MessageSuccess(data.message)
      }
      if (Array.isArray(data.warnings) && data.warnings.length) {
        this.output += '\n' + data.warnings.join('\n')
      }
      if (onCompleted) {
        try {
          await onCompleted(data)
        } catch (error) {
          const warning =
            'Flutter finished. ' + (error instanceof Error ? error.message : String(error))
          this.output += '\n' + warning
          MessageWarning(warning)
        }
      }
      return data
    } catch (error) {
      this.unknown = true
      this.output +=
        (error instanceof Error ? error.message : String(error)) +
        '\nCheck the result before restarting the app.'
      MessageError(this.output)
    } finally {
      this.running = false
      this.action = ''
    }
  }
}

class FlutterWorkbenchController {
  sdk = new FlutterRead({
    flutterBin: '',
    source: '',
    searchDirs: [] as string[],
    flutterVersion: '',
    dartVersion: '',
    channel: '',
    engineRevision: '',
    buildDate: ''
  })
  doctor = new FlutterRead({
    flutterBin: '',
    message: '',
    items: [] as DoctorItem[],
    raw: '',
    summary: { total: 0, ok: 0, warning: 0, error: 0, unknown: 0 }
  })
  readiness = new FlutterRead({
    env: { ANDROID_HOME: '', ANDROID_SDK_ROOT: '', JAVA_HOME: '' },
    summary: { passed: 0, total: 0, failed: 0 },
    checks: [] as Check[]
  })
  devices = new FlutterRead({
    adbPath: '',
    targetDevice: '',
    devices: [] as Device[],
    summary: { total: 0, online: 0, offline: 0, unauthorized: 0, other: 0 }
  })
  command = new FlutterAction()
  fix = new FlutterAction()
  deviceChange = new FlutterAction()
  deviceInfo = new FlutterRead({ state: '', details: '' })

  loadSdkInfo() {
    return this.sdk.refresh('flutterSdkInfo', [flutterSetup()])
  }
  fetchDoctor() {
    return this.doctor.refresh('flutterDoctor', [flutterSetup()])
  }
  fetchReadiness() {
    return this.readiness.refresh('androidReadiness')
  }
  fetchDevices() {
    return this.devices.refresh('androidDevices')
  }
  async runCommand(action: string, arg: string) {
    const data = await this.command.run(
      'flutterAdvancedAction',
      [action, arg, flutterSetup()],
      `$ flutter ${action}`
    )
    if (data?.ok && (action === 'upgrade' || action === 'channel-switch')) void this.loadSdkInfo()
  }
  async runAutoFix(action: string) {
    const result = await this.fix.run('androidAutoFix', [action], 'Applying Android changes…')
    if (result)
      await Promise.allSettled([this.fetchReadiness(), this.fetchDevices(), this.fetchDoctor()])
  }
  async runDeviceAction(action: 'set-target' | 'disconnect', id: string) {
    if (!this.devices.data.devices.some((device) => device.id === id)) return
    const result = await this.deviceChange.run(
      'androidDeviceAction',
      [action, id],
      `ADB ${action} ${id}`
    )
    if (!result?.ok) return
    if (result.targetDevice) this.devices.data.targetDevice = result.targetDevice
    await this.fetchDevices()
  }
  async runQuickAction(action: string, path: string) {
    if (!path) return
    await this.command.run('flutterQuickAction', [action, path], `$ flutter ${action}`)
  }
}

export const flutterWorkbench = reactiveBind(new FlutterWorkbenchController())
