<template>
  <div class="host-edit tools tools-file-info">
    <div class="nav p-0">
      <div class="left">
        <span class="text-xl">{{ I18nT('util.toolFileInfo') }}</span>
        <slot name="like"></slot>
      </div>
    </div>

    <div id="FileInfoDroper" class="main-wapper">
      <div class="select-dir-wapper">
        <div id="selectDir" @click.stop="choosePath">
          <yb-icon :svg="import('@/svg/upload.svg?raw')" class="icon" />
          <span>{{ I18nT('base.fileInfoTips') }}</span>
        </div>
      </div>
      <p v-if="controller.running" class="px-3 py-2" role="status">{{ controller.unknown ? 'Some file reads have not returned yet. The results below are incomplete; the original reads are still being observed.' : 'Reading file information…' }}</p>
      <p v-for="(reason, field) in controller.errors" :key="field" class="px-3 py-2 text-red-500" role="alert">{{ field }}: {{ reason }}</p>
      <ul v-if="path" class="info-wapper select-text">
        <el-descriptions border :title="path" :column="2" :direction="'vertical'">
          <el-descriptions-item label="file size">
            {{ info.size_str }}
          </el-descriptions-item>
          <el-descriptions-item label="">
            {{ info.size }}
          </el-descriptions-item>
          <el-descriptions-item label="create time">
            {{ info.btime_str }}
          </el-descriptions-item>
          <el-descriptions-item label="">
            {{ info.btime }}
          </el-descriptions-item>
          <el-descriptions-item label="change time">
            {{ info.ctime_str }}
          </el-descriptions-item>
          <el-descriptions-item label="">
            {{ info.ctime }}
          </el-descriptions-item>
          <el-descriptions-item label="access time">
            {{ info.atime_str }}
          </el-descriptions-item>
          <el-descriptions-item label="">
            {{ info.atime }}
          </el-descriptions-item>
          <el-descriptions-item label="modify time">
            {{ info.mtime_str }}
          </el-descriptions-item>
          <el-descriptions-item label="">
            {{ info.mtime }}
          </el-descriptions-item>
          <el-descriptions-item v-for="algorithm in fileHashAlgorithms" :key="algorithm" class-name="w-full overflow-hidden" :label="algorithm" :span="2">
            <div class="w-full overflow-hidden break-all whitespace-pre-wrap">{{ info[algorithm] }}</div>
            <el-button link :disabled="!info[algorithm]" @click="copyHash(info[algorithm])">Copy</el-button>
          </el-descriptions-item>
        </el-descriptions>
        <p v-if="copyStatus" role="status">{{ copyStatus }}</p>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
  import { formatBytes } from '@/util/Index'
  import { formatISO } from 'date-fns'
  import { clipboard, dialog } from '@/util/NodeFn'
  import { I18nT } from '@lang/index'
  import { fileInfoController as controller } from './Controller'
  import { fileHashAlgorithms } from './FileInfoModel'

  interface FileInfo {
    size_str: string
    size: number
    atime_str: string
    atime: number
    mtime_str: string
    mtime: number
    ctime_str: string
    ctime: number
    btime_str: string
    btime: number
    md5: string
    sha1: string
    sha256: string
    sha512: string
    sha512Base64: string
  }

  const path = computed(() => controller.path)
  const emptyInfo: FileInfo = {
    size_str: '',
    size: 0,
    atime_str: '',
    atime: 0,
    mtime_str: '',
    mtime: 0,
    ctime_str: '',
    ctime: 0,
    btime_str: '',
    btime: 0,
    md5: '',
    sha1: '',
    sha256: '',
    sha512: '',
    sha512Base64: ''
  }
  const info = computed<FileInfo>(() => {
    const stats = controller.metadata
    return {
      ...emptyInfo,
      ...controller.hashes,
      ...(stats ? {
        size: stats.size, size_str: formatBytes(stats.size),
        atime: stats.atimeMs, atime_str: formatISO(stats.atimeMs),
        btime: stats.birthtimeMs, btime_str: formatISO(stats.birthtimeMs),
        ctime: stats.ctimeMs, ctime_str: formatISO(stats.ctimeMs),
        mtime: stats.mtimeMs, mtime_str: formatISO(stats.mtimeMs)
      } : {})
    }
  })
  const copyStatus = ref('')
  const copyHash = async (value: string) => {
    try { await clipboard.writeText(value); copyStatus.value = 'Copied.' }
    catch { copyStatus.value = 'Clipboard access failed.' }
  }
  const timer = ref<number | null>(null)

  const choosePath = async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile']
    })

    if (canceled || filePaths.length === 0) return
    void controller.inspect(filePaths[0])
  }

  const scrollToBottom = (container: Element) => {
    const scroll = () => {
      if (Math.floor(container.scrollHeight - container.scrollTop - container.clientHeight) === 0) {
        if (timer.value) {
          cancelAnimationFrame(timer.value)
          timer.value = null
        }
        return
      }
      container.scrollTop += 60
      timer.value = requestAnimationFrame(scroll)
    }
    timer.value = requestAnimationFrame(scroll)
  }

  const setupDragAndDrop = () => {
    const selector = document.getElementById('FileInfoDroper')
    if (!selector) return

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer?.files.length) {
        void controller.inspect(window.QTEnvDevNodeAPI.showFilePath(e.dataTransfer.files[0]))
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    selector.addEventListener('drop', handleDrop)
    selector.addEventListener('dragover', handleDragOver)

    return () => {
      selector.removeEventListener('drop', handleDrop)
      selector.removeEventListener('dragover', handleDragOver)
    }
  }

  // Scroll only the mounted view after the controller receives every independent result.
  watch(() => controller.running, (running) => {
    if (running) return
    const container = document.getElementById('FileInfoDroper')
    if (container) scrollToBottom(container)
  })

  // Setup drag and drop on mount
  onMounted(() => {
    const cleanup = setupDragAndDrop()
    onUnmounted(() => {
      cleanup?.()
      if (timer.value) {
        cancelAnimationFrame(timer.value)
      }
    })
  })
</script>
