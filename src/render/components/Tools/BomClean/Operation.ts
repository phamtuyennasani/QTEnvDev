import { reactiveBind } from '@/util/Index'
import IPC from '@/util/IPC'
import { ToolOperation } from '../../../../render-next/tools/ToolOperation'
export const bomScan = reactiveBind(new ToolOperation(IPC))
export const bomClean = reactiveBind(new ToolOperation(IPC))
