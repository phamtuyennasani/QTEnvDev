<template>
  <ForgeDialog title="Site links" :description="host.name" wide @close="emit('close')">
    <div class="site-links">
      <div v-for="link in links" :key="link.url" class="site-link">
        <div>
          <code>{{ link.url }}</code>
          <p class="website-help">{{ link.label }}</p>
        </div>
        <button class="action-button" @click="copy(link.url)">Copy</button>
        <button class="action-button" @click="open(link.url)">Open ↗</button>
      </div>
      <p v-if="!links.length" class="website-help">No configured endpoint was found.</p>
      <p v-if="error" class="forge-alert forge-alert--error" role="alert">{{ error }}</p>
    </div>
  </ForgeDialog>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { clipboard, shell } from '@/util/NodeFn'
  import ForgeDialog from '../components/ForgeDialog.vue'
  import { showNotice } from '../state/app'
  import { websiteLinks } from './model'
  import { websiteError, type WebsiteHost } from './types'

  const props = defineProps<{ host: WebsiteHost }>()
  const emit = defineEmits<{ close: [] }>()
  const error = ref('')
  const links = computed(() => websiteLinks(props.host))

  async function copy(url: string) {
    error.value = ''
    try {
      await clipboard.writeText(url)
      showNotice('Site link copied.')
    } catch (failure) {
      error.value = websiteError(failure)
    }
  }

  async function open(url: string) {
    error.value = ''
    try {
      await shell.openExternal(url)
    } catch (failure) {
      error.value = websiteError(failure)
    }
  }
</script>

<style scoped>
  .site-link {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 0;
    border-bottom: 1px solid var(--pqt-border);
  }
  .site-link > div {
    flex: 1;
    min-width: 0;
  }
  .site-link code {
    overflow-wrap: anywhere;
  }
  .site-link p {
    margin: 4px 0 0;
  }
</style>
