import { reactiveBind } from '@/util/Index'
import IPC from '@/util/IPC'
import { RequestTimingOperation } from '../tools/RequestTimingOperation'
const operation = reactiveBind(new RequestTimingOperation(IPC))
export type { TimingMetric } from '../tools/RequestTimingOperation'
export const requestTimingController = { state: operation, fetch: () => operation.fetch() }
