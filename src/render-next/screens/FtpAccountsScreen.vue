<template>
  <section class="screen">
    <header class="page-header">
      <div><h1>FTP accounts</h1><p class="subtitle">Manage access to shared folders.</p></div>
      <div class="detail-actions">
        <button class="action-button" @click="navigateNext('services')">Back to services</button>
        <button class="action-button" :disabled="controller.busy" @click="controller.refresh()"
          >Refresh</button
        >
      </div>
    </header>
    <div v-if="pureAvailable" class="filter-tabs ftp-tabs">
      <button
        v-for="item in modes"
        :key="item"
        :class="{ active: mode === item }"
        :aria-pressed="mode === item"
        @click="mode = item"
        >{{ labels[item] }}</button
      >
    </div>
    <p v-if="controller.error" class="forge-alert forge-alert--error" role="alert">{{
      controller.error
    }}</p>
    <p v-if="controller.message" class="forge-alert" role="status">{{ controller.message }}</p>
    <p v-if="controller.warning" class="forge-alert ftp-message" role="status">{{
      controller.warning
    }}</p>

    <article class="panel ftp-panel" :aria-busy="controller.busy">
      <div class="ftp-heading">
        <div>
          <h2>{{ labels[mode] }}</h2>
          <p class="subtitle">{{ serviceLabel }}</p>
        </div>
        <div class="detail-actions">
          <button
            class="action-button"
            v-if="mode === 'pure-ftpd'"
            :disabled="controller.busy"
            @click="configOpen = true"
            >Configuration files</button
          >
          <button
            v-if="controller.status?.running"
            class="action-button"
            :disabled="controller.busy"
            @click="controller.change('restart')"
            >Restart</button
          >
          <button
            v-if="controller.status?.running"
            class="action-button"
            :disabled="controller.busy"
            @click="controller.change('stop')"
            >Stop</button
          >
          <button
            v-else
            class="primary-button"
            :disabled="!controller.status?.installed || controller.busy"
            @click="controller.change('start')"
            >Start</button
          >
        </div>
      </div>
      <label
        v-if="controller.status?.running && controller.addresses.length > 1"
        class="ftp-address"
      >
        Network address
        <select v-model="selectedAddress">
          <option value="">Automatic</option>
          <option v-for="address in controller.addresses" :key="address.ip" :value="address.ip"
            >{{ address.ip }} · {{ address.name }}</option
          >
        </select>
      </label>
      <p v-if="controller.status?.running && endpoint"
        ><code>{{ endpoint }}</code></p
      >
    </article>

    <article class="panel ftp-panel" :aria-busy="controller.busy">
      <div class="ftp-heading">
        <h2>Accounts</h2>
        <button class="action-button" :disabled="!editable" @click="openEditor()"
          >Add account</button
        >
      </div>
      <p v-if="!controller.accounts.length" class="empty-copy">{{
        controller.accountsVerified ? 'No accounts yet.' : 'The account list has not been verified.'
      }}</p>
      <div v-for="item in controller.accounts" :key="item.user" class="ftp-row">
        <div
          ><b>{{ item.user }}</b
          ><small>{{ item.dir }}</small></div
        >
        <div class="detail-actions">
          <button class="action-button" @click="controller.openFolder(item.dir)"
            >Open folder</button
          >
          <button
            class="action-button"
            :disabled="!controller.accountsVerified"
            @click="controller.copyPassword(item)"
            >Copy password</button
          >
          <button class="action-button" :disabled="!editable" @click="openEditor(item)"
            >Edit</button
          >
          <button class="action-button" :disabled="!editable" @click="pendingRemoval = item"
            >Remove</button
          >
        </div>
      </div>
    </article>

    <ForgeDialog
      v-if="draft"
      :title="editing ? 'Edit FTP account' : 'Add FTP account'"
      @close="closeEditor"
    >
      <form id="ftp-account-form" class="ftp-form" @submit.prevent="save">
        <label
          >Username<input
            v-model="draft.user"
            :readonly="editing || controller.busy"
            required
            autocomplete="off"
        /></label>
        <label
          >Password<input
            v-model="draft.pass"
            :type="showPassword ? 'text' : 'password'"
            :readonly="controller.busy"
            required
            autocomplete="new-password"
        /></label>
        <div class="detail-actions">
          <button class="action-button" type="button" @click="showPassword = !showPassword">{{
            showPassword ? 'Hide password' : 'Show password'
          }}</button>
          <button
            class="action-button"
            type="button"
            :disabled="controller.busy"
            @click="generatePassword"
            >Generate password</button
          >
        </div>
        <label
          >Folder
          <div class="ftp-path"
            ><input :value="draft.dir" readonly /><button
              class="action-button"
              type="button"
              :disabled="controller.busy"
              @click="chooseFolder"
              >Choose folder</button
            ></div
          ></label
        >
        <p v-if="controller.error" class="forge-alert forge-alert--error" role="alert">{{
          controller.error
        }}</p>
      </form>
      <template #footer>
        <button class="action-button" @click="closeEditor">Cancel</button>
        <button class="primary-button" form="ftp-account-form" type="submit" :disabled="!editable"
          >Save account</button
        >
      </template>
    </ForgeDialog>
    <ForgeDialog
      v-if="pendingRemoval"
      title="Remove FTP account?"
      :description="pendingRemoval.user"
      @close="pendingRemoval = undefined"
    >
      <p>The shared folder and its files will stay on disk.</p>
      <template #footer>
        <button class="action-button" @click="pendingRemoval = undefined">Cancel</button>
        <button class="action-button action-button--danger" :disabled="!editable" @click="remove"
          >Remove account</button
        >
      </template>
    </ForgeDialog>
    <ServiceFilesDialog
      v-if="configOpen"
      v-model="configOpen"
      kind="config"
      name="Pure-FTPd"
      :provider="pureConfigFiles"
      :after-save="afterConfigSave"
    />
  </section>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import type { FtpItem } from '@shared/app'
  import ForgeDialog from '../components/ForgeDialog.vue'
  import ServiceFilesDialog from '../components/ServiceFilesDialog.vue'
  import { ftpAccounts, pureConfigFiles, pureFtpSupported } from '../ftpAccounts/state'
  import type { FtpMode } from '../ftpAccounts/Controller'
  import { navigateNext } from '../state/app'

  const props = defineProps<{ mode?: FtpMode }>()
  const modes: FtpMode[] = ['ftp-srv', 'pure-ftpd']
  const labels = { 'ftp-srv': 'FTP Server', 'pure-ftpd': 'Pure-FTPd' }
  const pureAvailable = pureFtpSupported()
  const mode = ref<FtpMode>(pureAvailable && props.mode ? props.mode : 'ftp-srv')
  const controller = computed(() => ftpAccounts[mode.value])
  const draft = ref<FtpItem>()
  const editing = ref(false)
  const showPassword = ref(false)
  const configOpen = ref(false)
  const pendingRemoval = ref<FtpItem>()
  const selectedAddress = ref('')
  const editable = computed(
    () =>
      controller.value.accountsVerified &&
      controller.value.status?.installed &&
      !controller.value.busy
  )
  const serviceLabel = computed(() => {
    if (!controller.value.status) return 'Status unavailable'
    if (!controller.value.status.installed) return 'Install Pure-FTPd from Manage packages.'
    return controller.value.status.running ? 'Running' : 'Stopped'
  })
  const endpoint = computed(() => {
    const address =
      selectedAddress.value ||
      controller.value.addresses.find((item) => !item.isVirtual)?.ip ||
      controller.value.addresses[0]?.ip ||
      '127.0.0.1'
    const port = controller.value.status?.port
    return port ? `ftp://${address}:${port}/` : ''
  })
  const newPassword = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('')
  const openEditor = (item?: FtpItem) => {
    editing.value = Boolean(item)
    showPassword.value = false
    draft.value = item
      ? { ...item }
      : { user: '', pass: newPassword(), dir: '', disabled: false, mark: '' }
  }
  const closeEditor = () => {
    draft.value = undefined
  }
  const generatePassword = () => {
    if (draft.value) draft.value.pass = newPassword()
  }
  const chooseFolder = async () => {
    const item = draft.value
    const path = await controller.value.chooseFolder(item?.dir)
    if (path && item && draft.value === item) item.dir = path
  }
  const save = async () => {
    const item = draft.value
    if (item && (await controller.value.save({ ...item }, editing.value)) && draft.value === item)
      closeEditor()
  }
  const remove = async () => {
    const item = pendingRemoval.value
    if (item && (await controller.value.remove(item)) && pendingRemoval.value === item)
      pendingRemoval.value = undefined
  }
  const afterConfigSave = async () =>
    controller.value.status?.running ? ['Restart Pure-FTPd to apply the changes.'] : []
  watch(
    mode,
    () => {
      closeEditor()
      pendingRemoval.value = undefined
      configOpen.value = false
      selectedAddress.value = ''
      void controller.value.refresh()
    },
    { immediate: true }
  )
</script>

<style scoped>
  .ftp-tabs,
  .ftp-panel {
    margin-bottom: 12px;
  }
  .ftp-panel {
    padding: 16px;
  }
  .ftp-heading,
  .ftp-row,
  .ftp-path {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }
  .ftp-heading h2 {
    margin: 0;
  }
  .ftp-row {
    padding: 10px 0;
    border-bottom: 1px solid var(--pqt-border);
  }
  .ftp-row small {
    display: block;
    overflow-wrap: anywhere;
  }
  .ftp-form,
  .ftp-form label {
    display: grid;
    gap: 8px;
  }
  .ftp-path input {
    flex: 1;
    min-width: 120px;
  }
  .ftp-address {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ftp-message {
    white-space: pre-wrap;
  }
</style>
