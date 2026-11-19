import { reactiveBind } from '@/util/Index'
import IPC from '@/util/IPC'
export type SiteLink = { url: string; state: string; type?: string; size?: number }
export type SiteConfig = { dir: string; proxy: string; excludeLink: string; pageLimit: string; timeout: number; maxImgSize: number; maxVideoSize: number; windowCount: number }
class SiteSuckerController {
  config: SiteConfig = { dir: '', proxy: '', excludeLink: '', pageLimit: '100', timeout: 30, maxImgSize: 20, maxVideoSize: 100, windowCount: 2 }; url = ''; links: SiteLink[] = []; running = false; error = ''; status = 'Idle'; private listening = false
  init() { if (this.listening) return; this.listening = true; IPC.on('App-SiteSucker-Link').then((_key: string, link: SiteLink) => { const current = this.links.find((item) => item.url === link.url); if (current) Object.assign(current, link); else this.links.unshift(link) }); IPC.on('App-SiteSucker-Link-Stop').then(() => { this.running = false; this.status = 'Completed' }) }
  async run() { if (this.running || !this.url.trim()) return false; try { new URL(this.url) } catch { this.error = 'Enter a valid URL'; return false } this.running = true; this.error = ''; this.status = 'Running'; this.links = []; try { await this.request('app-sitesucker-run', { url: this.url.trim(), config: { ...this.config, pageLimit: String(Math.min(10000, Math.max(1, Number(this.config.pageLimit) || 100))) } }); return true } catch (e) { this.error = String(e); this.status = 'Failed'; this.running = false; return false } }
  async cancel() { if (!this.running) return; await this.request('app-sitesucker-stop'); this.running = false; this.status = 'Cancelled' }
  private request(command: string, ...args: unknown[]) { return new Promise<any>((resolve, reject) => { IPC.send(command, ...args).then((key: string, response: any) => { IPC.off(key); if (response?.code === 0 || response === true) resolve(response); else reject(new Error(response?.msg ?? (command + ' failed'))) }) }) }
}
export const siteSuckerController = reactiveBind(new SiteSuckerController())
