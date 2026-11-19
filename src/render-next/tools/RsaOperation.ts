import { ToolOperation, type ToolTransport } from './ToolOperation'
const unusedTransport: ToolTransport = { send() { throw new Error('RSA uses the preload generation service.') }, off() {} }
export class RsaOperation {
  publicKey = ''
  privateKey = ''
  operation = new ToolOperation(unusedTransport, 120_000)
  constructor(readonly generatePair: (input: { bits: number }) => Promise<{ publicKey: string; privateKey: string }>) {}
  generate(bits: number) {
    if (this.operation.running) return this.operation.runLocal(async () => undefined)
    if (!Number.isInteger(bits) || bits < 512 || bits > 16384 || bits % 8) { this.operation.error = 'Key size must be 512–16384 bits and a multiple of 8.'; return false }
    return this.operation.runLocal(async () => {
      const pair = await this.generatePair({ bits })
      if (!pair?.publicKey || !pair?.privateKey) throw new Error('The key generator did not return a complete key pair.')
      this.publicKey = pair.publicKey
      this.privateKey = pair.privateKey
    })
  }
}
