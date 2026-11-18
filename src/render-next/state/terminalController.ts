import { ref } from 'vue'
import XTerm from '@/util/XTerm'

const terminal = ref<XTerm>()
const open = ref(false)
const mount = async (element: HTMLElement) => {
  if (!terminal.value) terminal.value = new XTerm()
  await terminal.value.mount(element)
}
const close = async () => {
  const active = terminal.value
  terminal.value = undefined
  if (active) { await active.stop(); active.destroy() }
  open.value = false
}
export const terminalController = { terminal, open, mount, close }
