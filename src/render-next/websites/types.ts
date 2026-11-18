import type { AppHost } from '@/store/app'

export type WebsiteHost = AppHost & {
  reverseProxy?: Array<{ path: string; url: string }>
  startCommand?: string
}
export type ProjectItem = { id: number; name: string; domain: string; path: string; runtime: string; ssl: boolean; host: WebsiteHost }
export type WebsiteAction = 'add' | 'edit' | 'del'
export type WebsiteOperation = { id: number; action: WebsiteAction; status: 'running' | 'success' | 'failed' | 'unknown'; message: string; warnings: string[] }
export type WebsiteDependencies = {
  ready(): boolean
  list(): Promise<WebsiteHost[]>
  validate(host: Readonly<WebsiteHost>): Promise<void>
  write(host: Readonly<WebsiteHost>, action: WebsiteAction, old: Readonly<WebsiteHost> | undefined, progress: (message: string) => void): Promise<WebsiteHost[]>
  reconcile(hosts: WebsiteHost[]): void
  afterCommit(): Promise<string[]>
  open(url: string): Promise<void>
  choosePath(file: boolean, current: string): Promise<string | undefined>
  reveal(path: string): Promise<void>
  logFiles(id: number): Array<{ label: string; path: string }>
  notice(message: string): void
}
export class WebsiteOutcomeUnknown extends Error {}
export const websiteError = (error: unknown) => error instanceof Error ? error.message : String(error)
