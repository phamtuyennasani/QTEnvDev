import { createVNode, render } from 'vue'
import VueSvgSprite from '@/components/VueSvgIcon/svg.vue'

type SpriteHost = { element: HTMLDivElement; users: number }
const hosts = new WeakMap<Document, SpriteHost>()

/** All compatibility surfaces share one sprite, even when their lifetimes overlap. */
export function acquireLegacySvgSprite(document: Document) {
  let host = hosts.get(document)
  if (!host) {
    const element = document.createElement('div')
    element.dataset.pqtLegacySvgSprite = ''
    element.setAttribute('aria-hidden', 'true')
    element.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none'
    document.body.appendChild(element)
    render(createVNode(VueSvgSprite), element)
    host = { element, users: 0 }
    hosts.set(document, host)
  }
  host.users++
  let released = false
  return () => {
    if (released) return
    released = true
    if (--host.users !== 0) return
    render(null, host.element)
    host.element.remove()
    hosts.delete(document)
  }
}
