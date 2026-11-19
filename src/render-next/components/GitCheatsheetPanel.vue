<template>
  <ForgeDialog title="Git cheatsheet" description="Browse the complete command reference." eyebrow="WORKSPACE / CODE" wide @close="emit('close')">
    <label class="language">Reference language<select v-model="language"><option value="en">English</option><option value="vi">Tiếng Việt</option></select></label>
    <article class="reference" v-html="rendered" />
  </ForgeDialog>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import MarkdownIt from 'markdown-it'
import ForgeDialog from './ForgeDialog.vue'
import english from '@/components/Tools/GitCheatsheet/lang/git-memo.en.md?raw'
import vietnamese from '@/components/Tools/GitCheatsheet/lang/git-memo.vi.md?raw'
const emit = defineEmits<{ close: [] }>()
const language = ref('en')
const markdown = new MarkdownIt({ html: false, linkify: true })
const rendered = computed(() => markdown.render(language.value === 'vi' ? vietnamese : english))
</script>
<style scoped>
.language{display:flex;gap:10px;align-items:center;color:var(--pqt-text-muted);font-size:12px}.language select{padding:8px;background:var(--pqt-canvas);color:var(--pqt-text);border:1px solid var(--pqt-border);border-radius:6px}.reference{max-height:520px;overflow:auto;color:var(--pqt-text);font-size:12px;line-height:1.7}.reference :deep(pre){padding:12px;overflow:auto;background:var(--pqt-canvas);border-radius:6px}.reference :deep(table){width:100%;border-collapse:collapse}.reference :deep(td),.reference :deep(th){padding:8px;border:1px solid var(--pqt-border);text-align:left}.reference :deep(code){font-family:var(--pqt-font-mono)}.reference :deep(a){color:var(--pqt-accent)}
</style>
