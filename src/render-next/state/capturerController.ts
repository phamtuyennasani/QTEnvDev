import { reactiveBind } from '@/util/Index'
import IPC from '@/util/IPC'
type CapturerConfig = { key: string[]; dir: string; name: string; trialStartTime: number }
class CapturerController {
  config: CapturerConfig = { key: [], dir: '', name: 'qtenvdev-capturer-{timestamp}', trialStartTime: 0 }; running = false; error = ''; status = 'Idle'
  async saveConfig() { await this.request('Capturer:Config-Update', this.config); this.status = 'Configuration saved' }
  async capture(hideWindow = false) { if (this.running) return false; this.running = true; this.error = ''; this.status = 'Capturing'; try { await this.request('Capturer:doCapturer', hideWindow); this.status = 'Capture window opened'; return true } catch (e) { this.error = String(e); this.status = 'Failed'; return false } finally { this.running = false } }
  async cancel() { await this.request('Capturer:doStopCapturer'); this.status = 'Capture stopped'; this.running = false }
  private request(command: string, ...args: unknown[]) { return new Promise<any>((resolve, reject) => { IPC.send(command, ...args).then((key: string, response: any) => { IPC.off(key); if (response?.code === 0 || response === true || response === undefined) resolve(response); else reject(new Error(response?.msg ?? (command + ' failed'))) }) }) }
}
export const capturerController = reactiveBind(new CapturerController())
