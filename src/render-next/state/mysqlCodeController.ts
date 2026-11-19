import { reactiveBind } from '@/util/Index'
import IPC from '@/util/IPC'
import { MysqlCodeOperation } from '../tools/MysqlCodeOperation'
export const mysqlCodeController = reactiveBind(new MysqlCodeOperation({ send: (command, ...args) => IPC.sendSensitive(command, ...args), off: (key) => IPC.off(key) }))
