<template>
  <section class="screen tools-screen">
    <header class="page-header"><div><p class="eyebrow">WORKSPACE / TOOLS</p><h1>Toolbox</h1><p class="subtitle">Local utilities for the work between builds.</p></div><span class="toolbar-count">{{ availableCount }} local tools</span></header>
    <div class="tools-toolbar"><label class="search-box tools-search"><span>⌕</span><input v-model="query" placeholder="Search tools" /></label><div class="tool-tabs"><button v-for="category in toolController.categories" :key="category" :class="{ active: selectedCategory === category }" @click="selectedCategory = category">{{ category }}</button></div></div>
    <div class="tool-grid"><button v-for="tool in filteredTools" :key="tool.id" class="tool-card" :disabled="!tool.available" @click="launch(tool)"><span class="tool-glyph">{{ tool.glyph }}</span><span class="tool-card-copy"><b>{{ tool.name }}</b><small>{{ tool.description }}</small><em>{{ tool.available ? tool.category : 'Pending migration' }}</em></span><span class="tool-arrow">{{ tool.available ? '↗' : '—' }}</span></button><p v-if="!filteredTools.length" class="empty-copy">No tools match this search.</p></div>
    <LocalToolPanel v-if="selectedTool && selectedTool.id !== 'terminal'" :key="selectedTool.id" :tool="selectedTool" @close="selectedTool = undefined" />
    <TerminalPanel v-if="selectedTool?.id === 'terminal'" @close="selectedTool = undefined" />
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { toolController, type ToolItem } from '../state/toolController'
import LocalToolPanel from '../tools/LocalToolPanel.vue'
import TerminalPanel from '../components/TerminalPanel.vue'
const query = ref(''); const selectedCategory = ref('All'); const selectedTool = ref<ToolItem>()
const availableCount = toolController.tools.filter((tool) => tool.available).length
const filteredTools = computed(() => toolController.tools.filter((tool) => (selectedCategory.value === 'All' || selectedCategory.value === tool.category) && (tool.name + ' ' + tool.description).toLowerCase().includes(query.value.toLowerCase())))
const launch = (tool: ToolItem) => { if (tool.available) selectedTool.value = tool }
</script>
