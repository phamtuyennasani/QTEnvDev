<template>
  <ForgeDialog title="Composer" wide @close="$emit('close')">
    <div class="detail-actions composer-actions">
      <button class="action-button" :disabled="module.fetchInstalleding" @click="refresh">
        {{ module.fetchInstalleding ? 'Checking versions…' : 'Refresh installed versions' }}
      </button>
      <button class="action-button" @click="editFolders">Discovery folders</button>
      <button class="action-button" @click="openDownloads">Official downloads</button>
      <button class="action-button action-button--primary" @click="$emit('packages')">
        Manage Composer packages
      </button>
    </div>
    <div class="pqt-established-tool composer-versions">
      <LocalVersionManager type-flag="composer" />
    </div>
  </ForgeDialog>
</template>

<script setup lang="ts">
  import { useAsyncComponentShow } from '@/util/AsyncComponent'
  import { BrewStore } from '@/store/brew'
  import { shell } from '@/util/NodeFn'
  import CustomPath from '@/components/ServiceManager/customPath.vue'
  import LocalVersionManager from '@/components/VersionManager/local/index.vue'
  import { showNotice } from '../state/app'
  import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'
  import ForgeDialog from './ForgeDialog.vue'

  defineEmits<{ close: []; packages: [] }>()
  provideLegacyToolContext({ poperFix: true, detachedClass: 'pqt-composer-versions' })
  const showDialog = useAsyncComponentShow()
  const module = BrewStore().module('composer')

  const refresh = async () => {
    if (!(await module.fetchInstalled(false, { fresh: true }))) {
      showNotice('Could not refresh the installed Composer versions.')
    }
  }

  const editFolders = async () => {
    if (await showDialog(CustomPath, { flag: 'composer' })) await refresh()
  }

  const openDownloads = () => {
    shell.openExternal('https://getcomposer.org/download/').catch(() => {
      showNotice('Could not open the Composer download page.')
    })
  }
</script>

<style scoped>
  :global(.forge-dialog--wide:has(.composer-versions)) {
    width: 1000px;
  }

  .composer-actions {
    margin-bottom: 12px;
  }

  .composer-versions {
    height: clamp(220px, 48vh, 420px);
  }
</style>
