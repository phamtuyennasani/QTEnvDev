<template>
  <section class="screen tools-screen">
    <header class="page-header"><div><p class="eyebrow">WORKSPACE / TOOLS</p><h1>Toolbox</h1><p class="subtitle">Local utilities for the work between builds.</p></div><span class="toolbar-count">{{ availableCount }} local tools</span></header>
    <div class="tools-toolbar"><label class="search-box tools-search"><span>⌕</span><input v-model="query" placeholder="Search tools" /></label><div class="tool-tabs"><button v-for="category in toolController.categories" :key="category" :class="{ active: selectedCategory === category }" @click="selectedCategory = category">{{ category }}</button></div></div>
    <div class="tool-grid"><button v-for="tool in filteredTools" :key="tool.id" class="tool-card" :disabled="!tool.available" @click="launch(tool)"><span class="tool-glyph">{{ tool.glyph }}</span><span class="tool-card-copy"><b>{{ tool.name }}</b><small>{{ tool.description }}</small><em>{{ tool.available ? tool.category : 'Pending migration' }}</em></span><span class="tool-arrow">{{ tool.available ? '↗' : '—' }}</span></button><p v-if="!filteredTools.length" class="empty-copy">No tools match this search.</p></div>
    <LocalToolPanel v-if="selectedTool && !['terminal','request-time','websocket','playground','bom-clean','ssl-maker','process','environment','markdown','git-cheatsheet','http-status','url-parse','mime-types','regex-cheatsheet','file-info','keycode'].includes(selectedTool.id)" :key="selectedTool.id" :tool="selectedTool" @close="selectedTool = undefined" />
    <TerminalPanel v-if="selectedTool?.id === 'terminal'" @close="selectedTool = undefined" />
    <RequestTimingPanel v-if="selectedTool?.id === 'request-time'" @close="selectedTool = undefined" />
    <RealtimePanel v-if="selectedTool?.id === 'websocket'" @close="selectedTool = undefined" />
    <CodePlaygroundPanel v-if="selectedTool?.id === 'playground'" @close="selectedTool = undefined" />
    <BomCleanPanel v-if="selectedTool?.id === 'bom-clean'" @close="selectedTool = undefined" />
    <SslMakerPanel v-if="selectedTool?.id === 'ssl-maker'" @close="selectedTool = undefined" />
    <ProcessPanel v-if="selectedTool?.id === 'process'" @close="selectedTool = undefined" />
    <EnvironmentPanel v-if="selectedTool?.id === 'environment'" @close="selectedTool = undefined" />
    <MarkdownPanel v-if="selectedTool?.id === 'markdown'" @close="selectedTool = undefined" />
    <GitCheatsheetPanel v-if="selectedTool?.id === 'git-cheatsheet'" @close="selectedTool = undefined" />
    <HttpStatusPanel v-if="selectedTool?.id === 'http-status'" @close="selectedTool = undefined" />
    <UrlParsePanel v-if="selectedTool?.id === 'url-parse'" @close="selectedTool = undefined" />
    <MimeTypesPanel v-if="selectedTool?.id === 'mime-types'" @close="selectedTool = undefined" />
    <RegexCheatsheetPanel v-if="selectedTool?.id === 'regex-cheatsheet'" @close="selectedTool = undefined" />
    <FileInfoPanel v-if="selectedTool?.id === 'file-info'" @close="selectedTool = undefined" />
    <KeycodePanel v-if="selectedTool?.id === 'keycode'" @close="selectedTool = undefined" />
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { toolController, type ToolItem } from '../state/toolController'
import LocalToolPanel from '../tools/LocalToolPanel.vue'
import TerminalPanel from '../components/TerminalPanel.vue'
import RequestTimingPanel from '../components/RequestTimingPanel.vue'
import RealtimePanel from '../components/RealtimePanel.vue'
import CodePlaygroundPanel from '../components/CodePlaygroundPanel.vue'
import BomCleanPanel from '../components/BomCleanPanel.vue'
import SslMakerPanel from '../components/SslMakerPanel.vue'
import ProcessPanel from '../components/ProcessPanel.vue'
import EnvironmentPanel from '../components/EnvironmentPanel.vue'
import MarkdownPanel from '../components/MarkdownPanel.vue'
import GitCheatsheetPanel from '../components/GitCheatsheetPanel.vue'
import HttpStatusPanel from '../components/HttpStatusPanel.vue'
import UrlParsePanel from '../components/UrlParsePanel.vue'
import MimeTypesPanel from '../components/MimeTypesPanel.vue'
import RegexCheatsheetPanel from '../components/RegexCheatsheetPanel.vue'
import FileInfoPanel from '../components/FileInfoPanel.vue'
import KeycodePanel from '../components/KeycodePanel.vue'
const query = ref(''); const selectedCategory = ref('All'); const selectedTool = ref<ToolItem>()
const availableCount = toolController.tools.filter((tool) => tool.available).length
const filteredTools = computed(() => toolController.tools.filter((tool) => (selectedCategory.value === 'All' || selectedCategory.value === tool.category) && (tool.name + ' ' + tool.description).toLowerCase().includes(query.value.toLowerCase())))
const launch = (tool: ToolItem) => { if (tool.available) selectedTool.value = tool }
</script>
