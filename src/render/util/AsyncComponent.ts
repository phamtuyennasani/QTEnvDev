import { createVNode, getCurrentInstance, onMounted, proxyRefs, ref, render, type AppContext } from 'vue'
import { VueExtend } from '@/core/VueExtend'
import type { CallbackFn } from '@shared/app'

type AsyncComponentContext = AppContext & { asyncComponentHostClass?: string; acquireAsyncComponentHost?: () => () => void }

/** Capture a compatibility context during setup for dialogs opened by later events. */
export const useAsyncComponentShow = () => {
  const context = getCurrentInstance()?.appContext as AsyncComponentContext | undefined
  return (component: any, data?: any) => AsyncComponentShow(component, data, context)
}

export const AsyncComponentShow = (compontent: any, data?: any, context?: AsyncComponentContext) => {
  return new Promise((resolve) => {
    if (!compontent) throw new Error('The dialog component is not available.')
    let dom: HTMLElement | null = document.createElement('div')
    if (context?.asyncComponentHostClass) dom.className = context.asyncComponentHostClass
    document.body.appendChild(dom)
    const scoped = Boolean(context?.asyncComponentHostClass)
    const releaseHost = context?.acquireAsyncComponentHost?.()
    const vm: any = scoped ? undefined : VueExtend(compontent, data)
    const vnode = scoped ? createVNode(compontent, data) : undefined
    if (vnode) { vnode.appContext = context!; render(vnode, dom) }
    const intance = vnode ? proxyRefs(vnode.component?.exposed ?? {}) : vm.mount(dom)
    intance?.onClosed?.(() => {
      if (!dom) return
      if (scoped) render(null, dom!)
      else vm.unmount()
      intance?.$destroy?.()
      vm?.$destroy?.()
      dom?.remove?.()
      releaseHost?.()
      dom = null
    })
    intance?.onSubmit?.((arg: any) => {
      intance.show = false
      resolve(arg)
    })
  })
}

export const AsyncComponentSetup = () => {
  const show = ref(false)
  let closedFn: CallbackFn = () => {}
  let callback: CallbackFn = () => {}
  const onClosed = (fn: CallbackFn) => {
    closedFn = fn
  }
  const onSubmit = (fn: CallbackFn) => {
    callback = fn
  }
  onMounted(() => {
    show.value = true
  })
  return {
    show,
    closedFn: () => {
      closedFn()
    },
    callback: (arg: any) => {
      callback(arg)
    },
    onClosed,
    onSubmit
  }
}
