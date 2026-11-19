import { ToolOperation, type ToolTransport } from './ToolOperation'
export type MysqlCodeConnection = { user: string; password: string; host: string; port: number }
export class MysqlCodeOperation {
  databases: string[] = []
  operation: ToolOperation
  constructor(transport: ToolTransport) { this.operation = new ToolOperation(transport, 60_000) }
  connect(input: MysqlCodeConnection) {
    if (this.operation.running) return this.operation.run('app-fork:codemake', [], () => undefined)
    if (!input.user.trim() || !input.host.trim() || !Number.isInteger(input.port) || input.port < 1 || input.port > 65535) { this.operation.error = 'Enter a user, host and port between 1 and 65535.'; return false }
    const snapshot = { user: input.user.trim(), password: input.password, host: input.host.trim(), port: input.port }
    return this.operation.run('app-fork:codemake', ['connect', snapshot], (data) => {
      if (!Array.isArray(data)) throw new Error('Invalid database listing.')
      this.databases = data.map(String)
    })
  }
}
