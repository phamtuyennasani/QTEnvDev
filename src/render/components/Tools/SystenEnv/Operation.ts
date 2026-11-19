import { reactiveBind } from '@/util/Index'
import IPC from '@/util/IPC'
import { ToolOperation } from '../../../../render-next/tools/ToolOperation'
export const environmentSaveOperation = reactiveBind(new ToolOperation(IPC))
