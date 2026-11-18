<template>
  <Teleport to="body">
    <div class="forge-overlay" @click.self="emit('close')" @keydown.esc.stop.prevent="emit('close')">
      <section ref="dialog" class="forge-dialog" :class="{ 'forge-dialog--wide': wide }" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1" @keydown.tab="trapFocus">
        <header class="forge-dialog-header"><div><p class="eyebrow">{{ eyebrow }}</p><h2 :id="titleId">{{ title }}</h2><p v-if="description">{{ description }}</p></div><button class="forge-close" aria-label="Close dialog" @click="emit('close')">×</button></header>
        <div class="forge-dialog-body"><slot /></div>
        <footer v-if="$slots.footer" class="forge-dialog-footer"><slot name="footer" /></footer>
      </section>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
withDefaults(defineProps<{ title: string; description?: string; eyebrow?: string; wide?: boolean }>(), { eyebrow: 'PQT FORGE' })
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLElement>()
const titleId = useId()
const previousFocus = document.activeElement as HTMLElement | null
const trapFocus = (event: KeyboardEvent) => {
  const targets = Array.from(dialog.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter((element) => element.getClientRects().length)
  const first = targets[0]; const last = targets[targets.length - 1]
  if (!first) { event.preventDefault(); dialog.value?.focus(); return }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.value)) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
onMounted(async () => { await nextTick(); (dialog.value?.querySelector<HTMLElement>('[autofocus]') || dialog.value)?.focus() })
onBeforeUnmount(() => previousFocus?.isConnected && previousFocus.focus())
</script>
<style scoped>
.forge-overlay { position:fixed; inset:0; z-index:120; display:grid; place-items:center; padding:24px; background:rgb(3 8 11 / .78); backdrop-filter:blur(5px) }
.forge-dialog { display:flex; flex-direction:column; width:580px; max-width:calc(100vw - 48px); max-height:calc(100vh - 48px); overflow:hidden; border:1px solid var(--pqt-border-strong); border-radius:14px; background:var(--pqt-surface); box-shadow:0 24px 80px #0009; outline:none }
.forge-dialog--wide { width:760px }
.forge-dialog-header { display:flex; justify-content:space-between; gap:20px; padding:20px 22px 16px; border-bottom:1px solid var(--pqt-border) }
.forge-dialog-header .eyebrow { margin-bottom:7px }
.forge-dialog-header h2 { font-size:20px; margin:0 }
.forge-dialog-header p:not(.eyebrow) { font-size:12px; color:var(--pqt-text-muted); margin:7px 0 0; line-height:1.5 }
.forge-close { flex:0 0 30px; height:30px; border:1px solid var(--pqt-border); border-radius:7px; color:var(--pqt-text-muted); background:transparent; font-size:22px; cursor:pointer }
.forge-close:hover { color:var(--pqt-text); background:var(--pqt-surface-hover) }
.forge-dialog-body { min-height:0; overflow:auto; padding:18px 22px }
.forge-dialog-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 22px; border-top:1px solid var(--pqt-border) }
.forge-dialog :deep(button:focus-visible), .forge-dialog :deep(input:focus-visible), .forge-dialog :deep(select:focus-visible), .forge-dialog :deep(textarea:focus-visible) { outline:2px solid var(--pqt-accent); outline-offset:2px }
</style>
