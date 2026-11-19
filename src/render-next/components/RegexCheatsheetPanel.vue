<template>
  <ForgeDialog title="Regex cheatsheet" description="Complete syntax and examples from the local reference." eyebrow="WORKSPACE / CODE" wide @close="emit('close')">
    <article class="reference" v-html="rendered" />
  </ForgeDialog>
</template>
<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import ForgeDialog from './ForgeDialog.vue'
import reference from '@/components/Tools/RegexCheatsheet/regex-memo.content.md?raw'
const emit = defineEmits<{ close: [] }>()
const rendered = new MarkdownIt({ html: false, linkify: true }).render(reference)
</script>
<style scoped>
.reference{max-height:520px;overflow:auto;color:var(--pqt-text);font-size:12px;line-height:1.7}.reference :deep(pre){padding:12px;overflow:auto;background:var(--pqt-canvas);border-radius:6px}.reference :deep(table){width:100%;border-collapse:collapse}.reference :deep(td),.reference :deep(th){padding:8px;border:1px solid var(--pqt-border);text-align:left}.reference :deep(code){font-family:var(--pqt-font-mono)}.reference :deep(a){color:var(--pqt-accent)}
</style>
