<template>
  <section class="screen tools-screen">
    <header class="page-header">
      <div><p class="eyebrow">WORKSPACE / TOOLS</p><h1>Toolbox</h1><p class="subtitle">Local utilities for the work between builds.</p></div>
      <span class="toolbar-count">{{ availableCount }} local tools</span>
    </header>
    <div class="tools-toolbar">
      <label class="search-box tools-search"><span>⌕</span><input v-model="query" placeholder="Search tools" /></label>
      <div class="tool-tabs"><button v-for="category in toolController.categories" :key="category" :class="{ active: selectedCategory === category }" @click="selectedCategory = category">{{ category }}</button></div>
      <div class="tool-library-actions"><button class="action-button" :class="{ active: favoritesOnly }" @click="toggleFavorites">{{ favoritesOnly ? 'All tools' : 'Favorites' }}</button><button class="action-button" :class="{ active: customOnly }" @click="toggleCustom">{{ customOnly ? 'Built-in tools' : 'Custom tools' }}</button></div>
    </div>
    <p v-if="toolLibrary.error" class="forge-alert forge-alert--error" role="alert">{{ toolLibrary.error }}</p>
    <p v-if="toolLibrary.warning" class="forge-alert" role="status">{{ toolLibrary.warning }}</p>
    <div class="tool-grid">
      <article v-for="tool in filteredTools" :key="tool.id" class="tool-card" tabindex="0" role="button" :aria-disabled="!tool.available" @click="launch(tool)" @keydown.enter.self.prevent="launch(tool)">
        <span class="tool-glyph">{{ tool.glyph }}</span><button class="tool-favorite" :aria-label="(toolLibrary.isFavorite(tool.id) ? 'Remove favorite: ' : 'Add favorite: ') + tool.name" :aria-pressed="toolLibrary.isFavorite(tool.id)" @click.stop="toolLibrary.toggleFavorite(tool.id)">{{ toolLibrary.isFavorite(tool.id) ? '★' : '☆' }}</button>
        <span class="tool-card-copy"><b>{{ tool.name }}</b><small>{{ tool.description }}</small><em>{{ tool.available ? tool.category : 'Pending migration' }}</em></span><span class="tool-arrow">{{ tool.available ? '↗' : '—' }}</span>
      </article>
      <p v-if="!filteredTools.length && !filteredCustomTools.length && !customOnly" class="empty-copy">No tools match this search.</p>
    </div>
    <div v-if="customOnly" class="custom-tools-panel">
      <form class="custom-tools-form" @submit.prevent="saveCustom">
        <input v-model="customLabel" placeholder="Custom tool label" />
        <input v-model="customComponent" placeholder="https://example.com/tool" aria-label="Custom tool URL" />
        <button class="primary-button" :disabled="!customLabel.trim() || !customComponent || toolLibrary.saving > 0" type="submit">{{ editingCustomId ? 'Save custom tool' : 'Add custom tool' }}</button>
        <button v-if="editingCustomId" class="text-button" type="button" @click="resetCustomForm">Cancel edit</button>
      </form>
      <p v-if="customError" class="forge-alert forge-alert--error" role="alert">{{ customError }}</p>
      <article v-for="item in filteredCustomTools" :key="item.id" class="custom-tool-row">
        <span><b>{{ item.label }}</b><small>{{ item.component }}</small></span>
        <button class="action-button" @click="launchCustom(item)">Open</button><button class="action-button" :aria-pressed="toolLibrary.isFavorite(item.id)" @click="toolLibrary.toggleFavorite(item.id)">{{ toolLibrary.isFavorite(item.id) ? 'Unfavorite' : 'Favorite' }}</button><button class="text-button" @click="editCustom(item)">Edit</button><button class="text-button" :disabled="toolLibrary.saving > 0" @click="toolLibrary.removeCustom(item.id)">Remove</button>
      </article>
      <p v-if="!toolLibrary.custom.length" class="empty-copy">No custom tools saved.</p>
    </div>
    <div v-else-if="filteredCustomTools.length" class="custom-tools-panel"><h2>Custom tools</h2><article v-for="item in filteredCustomTools" :key="item.id" class="custom-tool-row"><span><b>{{ item.label }}</b><small>{{ item.component }}</small></span><button class="action-button" @click="launchCustom(item)">Open</button><button class="action-button" :aria-pressed="toolLibrary.isFavorite(item.id)" @click="toolLibrary.toggleFavorite(item.id)">{{ toolLibrary.isFavorite(item.id) ? 'Unfavorite' : 'Favorite' }}</button></article></div>
    <CustomToolPanel v-if="toolLibrary.opened" :key="toolLibrary.opened.id" />
    <LegacyToolPanel v-if="selectedTool && isLegacyToolSurface(selectedTool.id)" :key="selectedTool.id" :tool="selectedTool.id" @close="selectedTool = undefined" />
    <template v-if="!selectedTool || !isLegacyToolSurface(selectedTool.id)">
    <LocalToolPanel v-if="selectedTool && localPanelIds.includes(selectedTool.id)" :key="selectedTool.id" :tool="selectedTool" @close="selectedTool = undefined" />
    <TerminalPanel v-if="selectedTool?.id === 'terminal'" @close="selectedTool = undefined" /><RequestTimingPanel v-if="selectedTool?.id === 'request-time'" @close="selectedTool = undefined" /><RealtimePanel v-if="selectedTool?.id === 'websocket'" @close="selectedTool = undefined" /><CodePlaygroundPanel v-if="selectedTool?.id === 'playground'" @close="selectedTool = undefined" />
    <BomCleanPanel v-if="selectedTool?.id === 'bom-clean'" @close="selectedTool = undefined" /><SslMakerPanel v-if="selectedTool?.id === 'ssl-maker'" @close="selectedTool = undefined" /><ProcessPanel v-if="selectedTool?.id === 'process'" @close="selectedTool = undefined" /><EnvironmentPanel v-if="selectedTool?.id === 'environment'" @close="selectedTool = undefined" /><MarkdownPanel v-if="selectedTool?.id === 'markdown'" @close="selectedTool = undefined" /><GitCheatsheetPanel v-if="selectedTool?.id === 'git-cheatsheet'" @close="selectedTool = undefined" />
    <HttpStatusPanel v-if="selectedTool?.id === 'http-status'" @close="selectedTool = undefined" /><UrlParsePanel v-if="selectedTool?.id === 'url-parse'" @close="selectedTool = undefined" /><MimeTypesPanel v-if="selectedTool?.id === 'mime-types'" @close="selectedTool = undefined" /><RegexCheatsheetPanel v-if="selectedTool?.id === 'regex-cheatsheet'" @close="selectedTool = undefined" /><FileInfoPanel v-if="selectedTool?.id === 'file-info'" @close="selectedTool = undefined" /><KeycodePanel v-if="selectedTool?.id === 'keycode'" @close="selectedTool = undefined" />
    <QrCodePanel v-if="selectedTool?.id === 'qrcode'" @close="selectedTool = undefined" /><Base64FilePanel v-if="selectedTool?.id === 'base64-file'" @close="selectedTool = undefined" /><TokenPanel v-if="selectedTool?.id === 'token'" @close="selectedTool = undefined" /><RegexTesterPanel v-if="selectedTool?.id === 'regex-tester'" @close="selectedTool = undefined" /><EncryptionPanel v-if="selectedTool?.id === 'encryption'" @close="selectedTool = undefined" /><ChmodPanel v-if="selectedTool?.id === 'chmod'" @close="selectedTool = undefined" /><WifiQrPanel v-if="selectedTool?.id === 'wifi-qrcode'" @close="selectedTool = undefined" /><RsaPanel v-if="selectedTool?.id === 'rsa'" @close="selectedTool = undefined" />
    <ImageCompressPanel v-if="selectedTool?.id === 'image-compress'" @close="selectedTool = undefined" /><CodeLibraryPanel v-if="selectedTool?.id === 'code-library'" @close="selectedTool = undefined" /><PhpObfuscatorPanel v-if="selectedTool?.id === 'php-obfuscator'" @close="selectedTool = undefined" /><MysqlCodePanel v-if="selectedTool?.id === 'mysql-code'" @close="selectedTool = undefined" /><CronParserPanel v-if="selectedTool?.id === 'cron-parser'" @close="selectedTool = undefined" /><CapturerPanel v-if="selectedTool?.id === 'capturer'" @close="selectedTool = undefined" /><SiteSuckerPanel v-if="selectedTool?.id === 'site-sucker'" @close="selectedTool = undefined" />
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toolController, type ToolItem } from '../state/toolController'
import { toolLibraryController as toolLibrary, type CustomTool } from '../state/toolLibraryController'
import CustomToolPanel from '../components/CustomToolPanel.vue'
import LocalToolPanel from '../tools/LocalToolPanel.vue'
import LegacyToolPanel from '../components/LegacyToolPanel.vue'
import { isLegacyToolSurface } from '../tools/legacyToolSurfaces'
import TerminalPanel from '../components/TerminalPanel.vue'; import RequestTimingPanel from '../components/RequestTimingPanel.vue'; import RealtimePanel from '../components/RealtimePanel.vue'; import CodePlaygroundPanel from '../components/CodePlaygroundPanel.vue'; import BomCleanPanel from '../components/BomCleanPanel.vue'; import SslMakerPanel from '../components/SslMakerPanel.vue'; import ProcessPanel from '../components/ProcessPanel.vue'; import EnvironmentPanel from '../components/EnvironmentPanel.vue'; import MarkdownPanel from '../components/MarkdownPanel.vue'; import GitCheatsheetPanel from '../components/GitCheatsheetPanel.vue'; import HttpStatusPanel from '../components/HttpStatusPanel.vue'; import UrlParsePanel from '../components/UrlParsePanel.vue'; import MimeTypesPanel from '../components/MimeTypesPanel.vue'; import RegexCheatsheetPanel from '../components/RegexCheatsheetPanel.vue'; import FileInfoPanel from '../components/FileInfoPanel.vue'; import KeycodePanel from '../components/KeycodePanel.vue'; import QrCodePanel from '../components/QrCodePanel.vue'; import Base64FilePanel from '../components/Base64FilePanel.vue'; import TokenPanel from '../components/TokenPanel.vue'; import RegexTesterPanel from '../components/RegexTesterPanel.vue'; import EncryptionPanel from '../components/EncryptionPanel.vue'; import ChmodPanel from '../components/ChmodPanel.vue'; import WifiQrPanel from '../components/WifiQrPanel.vue'; import RsaPanel from '../components/RsaPanel.vue'; import ImageCompressPanel from '../components/ImageCompressPanel.vue'; import CodeLibraryPanel from '../components/CodeLibraryPanel.vue'; import PhpObfuscatorPanel from '../components/PhpObfuscatorPanel.vue'; import MysqlCodePanel from '../components/MysqlCodePanel.vue'; import CronParserPanel from '../components/CronParserPanel.vue'; import CapturerPanel from '../components/CapturerPanel.vue'; import SiteSuckerPanel from '../components/SiteSuckerPanel.vue'
const localPanelIds = ['json','base64','jwt','hash','diff','url','timestamp','html'] as string[]
const query = ref(''); const favoritesOnly = ref(false); const customOnly = ref(false); const customLabel = ref(''); const customComponent = ref(''); const customError = ref(''); const editingCustomId = ref(''); const selectedCategory = ref('All'); const selectedTool = ref<ToolItem>()
const availableTools = computed(() => toolController.tools.filter((tool) => tool.available))
const availableCount = computed(() => availableTools.value.length)
const filteredTools = computed(() => toolController.tools.filter((tool) => !customOnly.value && (!favoritesOnly.value || toolLibrary.isFavorite(tool.id)) && (selectedCategory.value === 'All' || selectedCategory.value === tool.category) && (tool.name + ' ' + tool.description).toLowerCase().includes(query.value.toLowerCase())))
const filteredCustomTools = computed(() => toolLibrary.custom.filter((tool) => (!favoritesOnly.value || toolLibrary.isFavorite(tool.id)) && (tool.label + ' ' + tool.component).toLowerCase().includes(query.value.toLowerCase())))
const resetCustomForm = () => { editingCustomId.value = ''; customLabel.value = ''; customComponent.value = '' }
const saveCustom = async () => { customError.value = ''; const ok = editingCustomId.value ? await toolLibrary.updateCustom(editingCustomId.value, customLabel.value, customComponent.value) : await toolLibrary.addCustom(customLabel.value, customComponent.value); if (ok) resetCustomForm() }
const editCustom = (item: CustomTool) => { editingCustomId.value = item.id; customLabel.value = item.label; customComponent.value = item.component }
const launchCustom = (item: CustomTool) => { const alias = toolController.tools.find((tool) => tool.id === item.component && tool.available); if (alias) launch(alias); else { selectedTool.value = undefined; toolLibrary.open(item) } }
const toggleFavorites = () => { favoritesOnly.value = !favoritesOnly.value; if (favoritesOnly.value) customOnly.value = false }
const toggleCustom = () => { customOnly.value = !customOnly.value; if (customOnly.value) favoritesOnly.value = false }
const launch = (tool: ToolItem) => { if (tool.available) { toolLibrary.close(); selectedTool.value = tool } }
onMounted(() => toolLibrary.init())
</script>
<style scoped>
.tool-library-actions{display:flex;gap:8px;flex-wrap:wrap}.custom-tools-panel{display:grid;gap:12px;margin-top:20px}.custom-tools-panel h2{font-size:14px;color:var(--pqt-text-muted)}.custom-tools-form{display:flex;gap:8px;flex-wrap:wrap}.custom-tools-form input{flex:1;min-width:180px;padding:10px;border:1px solid var(--pqt-border);border-radius:7px;background:var(--pqt-canvas);color:var(--pqt-text)}.custom-tool-row{display:flex;align-items:center;gap:8px;padding:12px;border:1px solid var(--pqt-border);border-radius:8px}.custom-tool-row>span{display:grid;gap:5px;flex:1;min-width:0}.custom-tool-row b,.custom-tool-row small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.custom-tool-row small{font-size:11px;color:var(--pqt-text-muted)}
</style>
