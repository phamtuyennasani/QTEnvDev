<template>
  <ForgeDialog
    title="Website backup"
    description="Export website settings and server configuration to JSON, or add websites from a backup."
    wide
    @close="emit('close')"
  >
    <div class="backup-panel">
      <p class="website-help">Project files, logs and TLS keys are stored separately.</p>
      <div class="backup-actions">
        <button class="action-button" :disabled="backup.busy" @click="backup.exportBackup()"
          >Export websites</button
        >
        <button class="action-button" :disabled="backup.busy" @click="backup.chooseBackup()"
          >Choose backup</button
        >
      </div>
      <p v-if="backup.file" class="backup-path">{{ backup.file }}</p>
      <template v-if="backup.preview">
        <ul class="backup-sites" aria-label="Websites in backup">
          <li v-for="site in backup.preview.sites" :key="site.id">
            <strong>{{ site.name }}</strong>
            <span>{{ site.type }} · {{ site.root }}</span>
          </li>
        </ul>
        <ul v-if="backup.preview.warnings.length" class="forge-alert">
          <li v-for="warning in backup.preview.warnings" :key="warning">{{ warning }}</li>
        </ul>
        <p class="website-help"
          >Confirm only if you trust the source of this backup and its server configuration.</p
        >
        <button class="primary-button" :disabled="backup.busy" @click="backup.confirmImport()">
          Import {{ backup.preview.sites.length }}
          {{ backup.preview.sites.length === 1 ? 'website' : 'websites' }}
        </button>
      </template>
      <p
        v-if="backup.message"
        :class="backup.waiting ? 'forge-alert' : 'website-help'"
        role="status"
        >{{ backup.message }}</p
      >
      <p v-if="backup.error" class="forge-alert forge-alert--error" role="alert">{{
        backup.error
      }}</p>
      <ul v-if="backup.warnings.length" class="forge-alert">
        <li v-for="warning in backup.warnings" :key="warning">{{ warning }}</li>
      </ul>
    </div>
  </ForgeDialog>
</template>

<script setup lang="ts">
  import ForgeDialog from '../components/ForgeDialog.vue'
  import { websiteBackup as backup } from './websiteBackup'

  const emit = defineEmits<{ close: [] }>()
</script>

<style scoped>
  .backup-panel {
    display: grid;
    gap: 12px;
  }
  .backup-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .backup-path,
  .backup-sites span {
    color: var(--pqt-muted);
    overflow-wrap: anywhere;
  }
  .backup-path {
    font: 12px var(--pqt-font-mono);
  }
  .backup-sites {
    margin: 0;
    padding: 0 8px 0 0;
    max-height: 220px;
    overflow: auto;
    list-style: none;
  }
  .backup-sites li {
    display: grid;
    gap: 4px;
    padding: 9px 0;
    border-bottom: 1px solid var(--pqt-border);
    font-size: 12px;
  }
  .backup-panel .primary-button {
    justify-self: start;
  }
  .backup-panel ul.forge-alert {
    margin: 0;
    padding-inline-start: 28px;
  }
</style>
