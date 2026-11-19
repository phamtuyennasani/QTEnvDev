<template>
  <section class="screen tools-screen">
    <header class="page-header"
      ><div
        ><p class="eyebrow">WORKSPACE / TOOLS</p><h1>Toolbox</h1
        ><p class="subtitle">Local utilities for the work between builds.</p></div
      ><span class="toolbar-count">{{ availableCount }} local tools</span></header
    >
    <div class="tools-toolbar"
      ><label class="search-box tools-search"
        ><span>⌕</span><input v-model="query" placeholder="Search tools" /></label
      ><div class="tool-tabs"
        ><button
          v-for="category in toolController.categories"
          :key="category"
          :class="{ active: selectedCategory === category }"
          @click="selectedCategory = category"
          >{{ category }}</button
        ></div
      ></div
      ><div class="tool-library-actions"><button class="action-button" :class="{ active: favoritesOnly }" @click="favoritesOnly = !favoritesOnly">{{ favoritesOnly ? 'All tools' : 'Favorites' }}</button><button class="action-button" :class="{ active: customOnly }" @click="customOnly = !customOnly">{{ customOnly ? 'Built-in tools' : 'Custom tools' }}</button></div
    >
    <div class="tool-grid"
      ><button
        v-for="tool in filteredTools"
        :key="tool.id"
        class="tool-card"
        :disabled="!tool.available"
        @click="launch(tool)"
        ><span class="tool-glyph">{{ tool.glyph }}</span
        ><span class="tool-favorite" @click.stop="toolLibrary.toggleFavorite(tool.id)">{{ toolLibrary.isFavorite(tool.id) ? '★' : '☆' }}</span
        ><span class="tool-card-copy"
          ><b>{{ tool.name }}</b
          ><small>{{ tool.description }}</small
          ><em>{{ tool.available ? tool.category : 'Pending migration' }}</em></span
        ><span class="tool-arrow">{{ tool.available ? '↗' : '—' }}</span></button
      ><p v-if="!filteredTools.length" class="empty-copy">No tools match this search.</p></div
    ><div v-if="customOnly" class="custom-tools-panel"><div class="custom-tools-form"><input v-model="customLabel" placeholder="Custom tool label" /><input v-model="customComponent" placeholder="Component or URL" /><button class="primary-button" :disabled="!customLabel.trim() || !customComponent.trim()" @click="addCustom">Add custom tool</button></div><article v-for="item in toolLibrary.custom" :key="item.id" class="custom-tool-row"><span><b>{{ item.label }}</b><small>{{ item.component }}</small></span><button class="text-button" @click="toolLibrary.removeCustom(item.id)">Remove</button></article><p v-if="!toolLibrary.custom.length" class="empty-copy">No custom tools saved.</p></div
    >
    <LocalToolPanel
      v-if="
        selectedTool &&
        ![
          'terminal',
          'request-time',
          'websocket',
          'playground',
          'bom-clean',
          'ssl-maker',
          'process',
          'environment',
          'markdown',
          'git-cheatsheet',
          'http-status',
          'url-parse',
          'mime-types',
          'regex-cheatsheet',
          'file-info',
          'keycode',
          'qrcode',
          'base64-file',
          'token',
          'regex-tester',
          'encryption',
          'chmod',
          'wifi-qrcode',
          'rsa',
          'image-compress',
          'code-library',
          'php-obfuscator',
          'mysql-code',
          'cron-parser'
          ,'capturer','site-sucker'
        ].includes(selectedTool.id)
      "
      :key="selectedTool.id"
      :tool="selectedTool"
      @close="selectedTool = undefined"
    />
    <TerminalPanel v-if="selectedTool?.id === 'terminal'" @close="selectedTool = undefined" />
    <RequestTimingPanel
      v-if="selectedTool?.id === 'request-time'"
      @close="selectedTool = undefined"
    />
    <RealtimePanel v-if="selectedTool?.id === 'websocket'" @close="selectedTool = undefined" />
    <CodePlaygroundPanel
      v-if="selectedTool?.id === 'playground'"
      @close="selectedTool = undefined"
    />
    <BomCleanPanel v-if="selectedTool?.id === 'bom-clean'" @close="selectedTool = undefined" />
    <SslMakerPanel v-if="selectedTool?.id === 'ssl-maker'" @close="selectedTool = undefined" />
    <ProcessPanel v-if="selectedTool?.id === 'process'" @close="selectedTool = undefined" />
    <EnvironmentPanel v-if="selectedTool?.id === 'environment'" @close="selectedTool = undefined" />
    <MarkdownPanel v-if="selectedTool?.id === 'markdown'" @close="selectedTool = undefined" />
    <GitCheatsheetPanel
      v-if="selectedTool?.id === 'git-cheatsheet'"
      @close="selectedTool = undefined"
    />
    <HttpStatusPanel v-if="selectedTool?.id === 'http-status'" @close="selectedTool = undefined" />
    <UrlParsePanel v-if="selectedTool?.id === 'url-parse'" @close="selectedTool = undefined" />
    <MimeTypesPanel v-if="selectedTool?.id === 'mime-types'" @close="selectedTool = undefined" />
    <RegexCheatsheetPanel
      v-if="selectedTool?.id === 'regex-cheatsheet'"
      @close="selectedTool = undefined"
    />
    <FileInfoPanel v-if="selectedTool?.id === 'file-info'" @close="selectedTool = undefined" />
    <KeycodePanel v-if="selectedTool?.id === 'keycode'" @close="selectedTool = undefined" />
    <QrCodePanel v-if="selectedTool?.id === 'qrcode'" @close="selectedTool = undefined" />
    <Base64FilePanel v-if="selectedTool?.id === 'base64-file'" @close="selectedTool = undefined" />
    <TokenPanel v-if="selectedTool?.id === 'token'" @close="selectedTool = undefined" />
    <RegexTesterPanel
      v-if="selectedTool?.id === 'regex-tester'"
      @close="selectedTool = undefined"
    />
    <EncryptionPanel v-if="selectedTool?.id === 'encryption'" @close="selectedTool = undefined" />
    <ChmodPanel v-if="selectedTool?.id === 'chmod'" @close="selectedTool = undefined" />
    <WifiQrPanel v-if="selectedTool?.id === 'wifi-qrcode'" @close="selectedTool = undefined" />
    <RsaPanel v-if="selectedTool?.id === 'rsa'" @close="selectedTool = undefined" />
    <ImageCompressPanel
      v-if="selectedTool?.id === 'image-compress'"
      @close="selectedTool = undefined"
    />
    <CodeLibraryPanel
      v-if="selectedTool?.id === 'code-library'"
      @close="selectedTool = undefined"
    />
    <PhpObfuscatorPanel
      v-if="selectedTool?.id === 'php-obfuscator'"
      @close="selectedTool = undefined"
    />
    <MysqlCodePanel v-if="selectedTool?.id === 'mysql-code'" @close="selectedTool = undefined" />
    <CronParserPanel v-if="selectedTool?.id === 'cron-parser'" @close="selectedTool = undefined" />
    <CapturerPanel v-if="selectedTool?.id === 'capturer'" @close="selectedTool = undefined" />
    <SiteSuckerPanel v-if="selectedTool?.id === 'site-sucker'" @close="selectedTool = undefined" />
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
  import QrCodePanel from '../components/QrCodePanel.vue'
  import Base64FilePanel from '../components/Base64FilePanel.vue'
  import TokenPanel from '../components/TokenPanel.vue'
  import RegexTesterPanel from '../components/RegexTesterPanel.vue'
  import EncryptionPanel from '../components/EncryptionPanel.vue'
  import ChmodPanel from '../components/ChmodPanel.vue'
  import WifiQrPanel from '../components/WifiQrPanel.vue'
  import RsaPanel from '../components/RsaPanel.vue'
  import ImageCompressPanel from '../components/ImageCompressPanel.vue'
  import CodeLibraryPanel from '../components/CodeLibraryPanel.vue'
  import PhpObfuscatorPanel from '../components/PhpObfuscatorPanel.vue'
  import MysqlCodePanel from '../components/MysqlCodePanel.vue'
  import CronParserPanel from '../components/CronParserPanel.vue'
  import CapturerPanel from '../components/CapturerPanel.vue'
  import SiteSuckerPanel from '../components/SiteSuckerPanel.vue'
  import { toolLibraryController as toolLibrary } from '../state/toolLibraryController'
  import { onMounted } from 'vue'
  const query = ref('')
  const favoritesOnly = ref(false)
  const customOnly = ref(false)
  const customLabel = ref('')
  const customComponent = ref('')
  const selectedCategory = ref('All')
  const selectedTool = ref<ToolItem>()
  const availableCount = toolController.tools.filter((tool) => tool.available).length
  const filteredTools = computed(() =>
    toolController.tools.filter(
      (tool) =>
        !customOnly.value &&
        (!favoritesOnly.value || toolLibrary.isFavorite(tool.id)) &&
        (selectedCategory.value === 'All' || selectedCategory.value === tool.category) &&
        (tool.name + ' ' + tool.description).toLowerCase().includes(query.value.toLowerCase())
    )
  )
  const addCustom = async () => {
    await toolLibrary.addCustom(customLabel.value, customComponent.value)
    customLabel.value = ''
    customComponent.value = ''
  }
  onMounted(() => toolLibrary.init())
  const launch = (tool: ToolItem) => {
    if (tool.available) selectedTool.value = tool
  }
</script>
