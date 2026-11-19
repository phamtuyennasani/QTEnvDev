import type { ModuleInstalledItem } from '@/core/Module/ModuleInstalledItem'
import { MysqlStore } from './mysql'

type Action = 'start' | 'stop' | 'restart'
type Result = { result: string | boolean; warning?: string }

async function safely(work: () => Promise<string | boolean>) {
  try {
    return await work()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

export async function stopMysqlCompanions(): Promise<string | true> {
  if (!window.Server?.MysqlDir) return true
  const groups = MysqlStore()
  await groups.init()
  return groups.groupStop()
}

/** Keep the primary terminal outcome distinct from supplementary group operations. */
export async function runMysqlServiceLifecycle(
  item: ModuleInstalledItem,
  action: Action
): Promise<Result> {
  if (action === 'stop') {
    const [primary, groups] = await Promise.all([
      safely(() => item.stop()),
      safely(stopMysqlCompanions)
    ])
    if (primary !== true) {
      const errors = [String(primary), ...(groups === true ? [] : ['MySQL groups: ' + groups])]
      return { result: errors.join('\n') }
    }
    return {
      result: true,
      ...(groups === true ? {} : { warning: 'MySQL groups: ' + groups })
    }
  }

  const result = await safely(() => item[action]())
  if (result !== true) return { result }
  if (!window.Server?.MysqlDir) return { result: true }
  const groups = await safely(() => MysqlStore().groupStart())
  return {
    result: true,
    ...(groups === true ? {} : { warning: 'MySQL groups: ' + groups })
  }
}
