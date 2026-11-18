<template><div v-if="open" class="command-backdrop" @click.self="close"><section class="command-palette" role="dialog" aria-label="Quick open"><div class="command-input"><span>⌕</span><input ref="input" v-model="query" placeholder="Search workspace or action" @keydown.esc="close" /></div><button v-for="item in filtered" :key="item.id" class="command-item" @click="run(item)"><span>{{ item.glyph }}</span><span><b>{{ item.label }}</b><small>{{ item.hint }}</small></span><kbd>{{ item.key }}</kbd></button><p v-if="filtered.length === 0" class="empty-copy">No commands found.</p></section></div></template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { navigateNext, type Workspace } from '../state/app'
const open = ref(false); const query = ref(''); const input = ref<HTMLInputElement>()
const commands = [{ id: 'overview', label: 'Open overview', hint: 'Environment status', glyph: '⌂', key: '1', workspace: 'overview' }, { id: 'services', label: 'Open services', hint: 'Processes and ports', glyph: '◉', key: '2', workspace: 'services' }, { id: 'websites', label: 'Open websites', hint: 'Projects and hosts', glyph: '⌁', key: '3', workspace: 'websites' }, { id: 'runtimes', label: 'Open runtimes', hint: 'Versions and defaults', glyph: '⌘', key: '4', workspace: 'runtimes' }, { id: 'databases', label: 'Open databases', hint: 'Data services', glyph: '◈', key: '5', workspace: 'databases' }, { id: 'startup-groups', label: 'Open startup groups', hint: 'Saved service sequences', glyph: '▶', key: '6', workspace: 'startup-groups' }, { id: 'tools', label: 'Open toolbox', hint: 'Developer utilities', glyph: '✦', key: '7', workspace: 'tools' }, { id: 'logs', label: 'Open logs', hint: 'Live application events', glyph: '≋', key: '8', workspace: 'logs' }, { id: 'settings', label: 'Open settings', hint: 'Preferences', glyph: '⚙', key: '9', workspace: 'settings' }] as const
const filtered = computed(() => commands.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(query.value.toLowerCase())))
const show = async () => { open.value = true; query.value = ''; await nextTick(); input.value?.focus() }
const close = () => { open.value = false }
const run = (item: (typeof commands)[number]) => { navigateNext(item.workspace as Workspace); close() }
watch(open, (value) => { if (value) void nextTick(() => input.value?.focus()) })
defineExpose({ show, close })
</script>
