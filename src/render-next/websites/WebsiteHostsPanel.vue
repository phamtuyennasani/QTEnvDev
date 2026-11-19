<template>
  <ForgeDialog
    title="System hosts"
    description="Map saved website names to this computer."
    @close="emit('close')"
  >
    <div class="website-form">
      <label class="website-toggle">
        <span
          ><b>Update system hosts automatically</b
          ><small>Apply website names and aliases when you save a site.</small></span
        >
        <input type="checkbox" :checked="settings.write" :disabled="busy" @change="setWrite" />
      </label>
      <label v-if="settings.write" class="website-toggle">
        <span><b>Include IPv6</b><small>Map names to both loopback addresses.</small></span>
        <input
          type="checkbox"
          :checked="settings.ipv6 !== false"
          :disabled="busy"
          @change="setIPv6"
        />
      </label>
      <div class="detail-actions">
        <button class="action-button" :disabled="busy" @click="sync">Sync now</button>
        <button class="action-button" @click="copyPreview">Copy generated entries</button>
        <button class="action-button" @click="revealPreview">Show generated file</button>
        <button class="action-button" :disabled="busy" @click="openEditor"
          >Edit system hosts</button
        >
      </div>
      <p v-if="error" class="forge-alert forge-alert--error" role="alert">{{ error }}</p>
    </div>
  </ForgeDialog>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { AppStore } from '@/store/app'
  import hostsSettings from '@/components/Host/HostsSettingsController'
  import { useAsyncComponentShow } from '@/util/AsyncComponent'
  import { clipboard, fs } from '@/util/NodeFn'
  import { join } from '@/util/path-browserify'
  import ForgeDialog from '../components/ForgeDialog.vue'
  import { showNotice } from '../state/app'
  import { projectController } from '../state/projectController'
  import { provideLegacyToolContext } from '../tools/provideLegacyToolContext'
  import { websiteError } from './types'

  const emit = defineEmits<{ close: [] }>()
  provideLegacyToolContext()
  const openEstablished = useAsyncComponentShow()
  const settings = computed(() => AppStore().config.setup.hosts)
  const busy = computed(() => projectController.saving || projectController.loading)
  const error = ref('')

  const findPreview = () => {
    if (!window.Server?.BaseDir) throw new Error('The application data directory is not ready.')
    return join(window.Server.BaseDir, 'app.hosts.txt')
  }

  async function run(command: () => Promise<unknown>) {
    error.value = ''
    try {
      await command()
    } catch (failure) {
      error.value = websiteError(failure)
    }
  }

  const sync = () => run(() => projectController.runExclusive(() => hostsSettings.sync()))
  const setWrite = (event: Event) => {
    const field = event.target as HTMLInputElement
    const value = field.checked
    field.checked = settings.value.write
    return run(() => projectController.runExclusive(() => hostsSettings.setWrite(value)))
  }
  const setIPv6 = (event: Event) => {
    const field = event.target as HTMLInputElement
    const value = field.checked
    field.checked = settings.value.ipv6 !== false
    return run(() => projectController.runExclusive(() => hostsSettings.setIPv6(value)))
  }
  const copyPreview = () =>
    run(async () => {
      const text = await fs.readFileStrict(findPreview())
      await clipboard.writeText(text)
      showNotice('Generated hosts entries copied.')
    })
  const revealPreview = () => run(() => projectController.reveal(findPreview()))
  const openEditor = () =>
    run(async () => {
      const { default: Editor } = await import('@/components/Host/Hosts.vue')
      void openEstablished(Editor).catch((failure) => {
        error.value = websiteError(failure)
      })
    })
</script>
