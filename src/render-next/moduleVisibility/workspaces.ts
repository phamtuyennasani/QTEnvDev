import type { AllAppModule } from '@/core/type'
import type { Workspace } from '../state/app'
import { isBuiltinModuleVisible } from './visibility'

const workspaceModules: Partial<Record<Workspace, AllAppModule[]>> = {
  websites: ['hosts'],
  'startup-groups': ['startup-group'],
  tools: ['tools'],
  cron: ['cron'],
  'http-serve': ['httpserver'],
  'dns-server': ['dns'],
  'ftp-accounts': ['ftp-srv', 'pure-ftpd'],
  podman: ['podman']
}

export const isWorkspaceVisible = (workspace: Workspace) =>
  workspaceModules[workspace]?.some(isBuiltinModuleVisible) ?? true
