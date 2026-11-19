import { reactiveBind } from '@/util/Index'
import IPC from '@/util/IPC'
import { ToolOperation } from '../../../../render-next/tools/ToolOperation'
import { MessageError, MessageSuccess } from '@/util/Element'
import { shell } from '@/util/NodeFn'
class PhpObfuscatorController {
  item = { phpversion: '', src: '', desc: '', config: '' }
  operation = new ToolOperation(IPC)
  output = ''
  run(bin: string) {
    if (this.operation.running) return
    const source = this.item.src.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
    const output = this.item.desc.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
    if (!source || !output || source === output || output.startsWith(source + '/') || !bin.trim()) { this.operation.error = 'Choose a PHP runtime and output outside the source path.'; MessageError(this.operation.error); return }
    const snapshot = { ...this.item, bin }
    return this.operation.run('app-fork:php', ['doObfuscator', snapshot], () => { this.output = snapshot.desc; MessageSuccess('Obfuscation completed.') }).then((done) => { if (!done) MessageError(this.operation.error) })
  }
  async reveal() { try { await shell.showItemInFolder(this.output) } catch (error) { this.operation.warning = 'Output was completed, but opening the folder failed: ' + String(error) } }
}
export default reactiveBind(new PhpObfuscatorController())
