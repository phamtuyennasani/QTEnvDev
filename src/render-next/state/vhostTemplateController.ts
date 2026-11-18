import { reactiveBind } from '@/util/Index'
import { fs, shell } from '@/util/NodeFn'
import { join } from '@/util/path-browserify'
import { showNotice } from './app'

export type VhostTemplateKey = 'nginx' | 'nginxSSL' | 'apache' | 'apacheSSL' | 'caddy' | 'caddySSL' | 'frankenphp' | 'frankenphpSSL'
export type VhostTemplate = { key: VhostTemplateKey; label: string; custom: string; fallback: string }
const definitions: Array<[VhostTemplateKey, string, string, string]> = [
  ['nginx', 'Nginx HTTP', 'nginx.vhost', 'nginx.vhost'], ['nginxSSL', 'Nginx HTTPS', 'nginxSSL.vhost', 'nginxSSL.vhost'],
  ['apache', 'Apache HTTP', 'apache.vhost', 'apache.vhost'], ['apacheSSL', 'Apache HTTPS', 'apacheSSL.vhost', 'apacheSSL.vhost'],
  ['caddy', 'Caddy HTTP', 'caddy.vhost', 'CaddyfileVhost'], ['caddySSL', 'Caddy HTTPS', 'caddySSL.vhost', 'CaddyfileVhostSSL'],
  ['frankenphp', 'FrankenPHP HTTP', 'frankenphp.vhost', 'FrankenphpVhost'], ['frankenphpSSL', 'FrankenPHP HTTPS', 'frankenphpSSL.vhost', 'FrankenphpVhostSSL']
]
class VhostTemplateController {
  templates: VhostTemplate[] = []; selected: VhostTemplateKey = 'nginx'; content = ''; loading = false; saving = false; error = ''
  private loadFlight?: Promise<boolean>; private saveFlight?: Promise<boolean>
  private list(): VhostTemplate[] { const base = String(window.Server?.BaseDir || ''); const staticRoot = String(window.Server?.Static || ''); return definitions.map(([key, label, customName, fallbackName]) => ({ key, label, custom: join(base, 'VhostTemplate', customName), fallback: join(staticRoot, 'tmpl', fallbackName) })) }
  async load(key: VhostTemplateKey = this.selected): Promise<boolean> {
    if (this.loadFlight) return this.loadFlight
    this.templates = this.list(); this.selected = key; this.loading = true; this.error = ''
    const template = this.templates.find((item) => item.key === key)
    const flight = Promise.resolve().then(async () => { if (!template) throw new Error('Unknown vhost template.'); const source = await fs.existsSync(template.custom) ? template.custom : template.fallback; this.content = await fs.readFile(source); return true }).catch((error) => { this.error = error instanceof Error ? error.message : String(error); showNotice(this.error); return false }).finally(() => { this.loading = false; this.loadFlight = undefined })
    this.loadFlight = flight; return flight
  }
  async save(): Promise<boolean> {
    if (this.saveFlight || this.loading) return false
    const template = this.templates.find((item) => item.key === this.selected)
    if (!template) { this.error = 'Select a vhost template first.'; return false }
    this.saving = true; this.error = ''
    const flight = Promise.resolve().then(async () => { await fs.mkdirp(join(String(window.Server.BaseDir), 'VhostTemplate')); await fs.writeFile(template.custom, this.content); showNotice(template.label + ' template saved.'); return true }).catch((error) => { this.error = error instanceof Error ? error.message : String(error); showNotice(this.error); return false }).finally(() => { this.saving = false; this.saveFlight = undefined })
    this.saveFlight = flight; return flight
  }
  async reveal(): Promise<void> { const template = this.templates.find((item) => item.key === this.selected); if (template) await shell.showItemInFolder(template.custom).catch((error) => { this.error = error instanceof Error ? error.message : String(error); showNotice(this.error) }) }
}
export const vhostTemplateController = reactiveBind(new VhostTemplateController())
