import type { AppHost } from '@/store/app'
import type { TomcatSiteFormConfig } from '@/components/Host/Tomcat/site'

export type WebsiteHost = AppHost & {
  reverseProxy?: Array<{ path: string; url: string }>
  startCommand?: string
  tomcat?: TomcatSiteFormConfig
}
export type ProjectItem = {
  id: number
  name: string
  domain: string
  path: string
  runtime: string
  ssl: boolean
  host: WebsiteHost
}
export type WebsiteAction = 'add' | 'edit' | 'del' | 'park'
export type OrderAction = 'up' | 'down' | 'pin' | 'unpin'
export type WebsiteOperation = {
  id: number
  action: WebsiteAction | 'order' | 'import'
  status: 'running' | 'success' | 'failed' | 'unknown'
  message: string
  warnings: string[]
}
type WebsiteWriteResult = {
  hosts: WebsiteHost[]
  warnings: string[]
  message?: string
  sync?: boolean
  outcome?: 'unknown'
}
export type WebsiteDependencies = {
  ready(): boolean
  list(): Promise<WebsiteHost[]>
  validate(host: Readonly<WebsiteHost>): Promise<void>
  write(
    host: Readonly<WebsiteHost>,
    action: WebsiteAction,
    old: Readonly<WebsiteHost> | undefined,
    progress: (message: string) => void,
    includeSubdirectories?: boolean
  ): Promise<WebsiteHost[] | WebsiteWriteResult>
  reconcile(hosts: WebsiteHost[]): void
  afterCommit(): Promise<string[]>
  reorder?(id: number, order: number[], action: OrderAction): Promise<WebsiteHost[]>
  open(url: string): Promise<void>
  choosePath(file: boolean, current: string): Promise<string | undefined>
  reveal(path: string): Promise<void>
  logFiles(id: number, host: WebsiteHost): WebsiteFile[] | Promise<WebsiteFile[]>
  vhostFiles(id: number, host: WebsiteHost): WebsiteFile[] | Promise<WebsiteFile[]>
  afterFileSave?(path: string): Promise<string[]>
  notice(message: string): void
}
type WebsiteFile = { label: string; path: string; readOnly?: boolean }
export class WebsiteOutcomeUnknown extends Error {}
export const websiteError = (error: unknown) =>
  error instanceof Error ? error.message : String(error)
