<template>
  <section class="screen">
    <header class="page-header">
      <div>
        <h1>DNS Server</h1>
        <p class="subtitle">Resolve local website names from devices on your network.</p>
      </div>
      <div class="detail-actions">
        <button class="action-button" @click="navigateNext('services')">Back to services</button>
        <button class="action-button" :disabled="busy" @click="controller.refresh()"
          >Refresh</button
        >
      </div>
    </header>

    <p v-if="controller.error" class="forge-alert forge-alert--error dns-message" role="alert">{{
      controller.error
    }}</p>
    <p v-if="controller.syncError" class="forge-alert forge-alert--error" role="alert">{{
      controller.syncError
    }}</p>
    <p v-if="controller.notice" class="forge-alert" role="status">{{ controller.notice }}</p>

    <article class="panel dns-panel" :aria-busy="busy">
      <div class="dns-panel-header">
        <div>
          <h2>{{ statusLabel }}</h2>
          <p v-if="controller.status?.running" class="subtitle">
            Use <code>{{ endpoint }}</code> as the DNS server on your device. The listener uses UDP
            port 53.
          </p>
        </div>
        <div class="detail-actions">
          <button
            v-if="controller.status?.running"
            class="action-button"
            :disabled="busy"
            @click="controller.change('restart')"
            >Restart</button
          >
          <button
            v-if="controller.status?.running"
            class="action-button"
            :disabled="busy"
            @click="controller.change('stop')"
            >Stop</button
          >
          <button
            v-else
            class="primary-button"
            :disabled="busy || !controller.status"
            @click="controller.change('start')"
            >Start</button
          >
        </div>
      </div>
      <label
        v-if="controller.status?.address === '0.0.0.0' && controller.interfaces.length"
        class="dns-interface"
      >
        Network address
        <select v-model="selectedInterface">
          <option value="">Automatic</option>
          <option v-for="item in controller.interfaces" :key="item.ip" :value="item.ip"
            >{{ item.ip }} · {{ item.name }}</option
          >
        </select>
      </label>
    </article>

    <article class="panel dns-panel">
      <div class="dns-panel-header">
        <div>
          <h2>Configuration</h2>
          <p class="subtitle">Choose a bind address, upstream resolvers and custom host records.</p>
        </div>
        <button class="action-button" :disabled="busy || !controller.config" @click="openConfig"
          >Edit configuration</button
        >
      </div>
    </article>

    <article class="panel dns-panel">
      <div class="dns-panel-header">
        <h2>Query log</h2>
        <button class="action-button" :disabled="!controller.logs.length" @click="clearOpen = true"
          >Clear log</button
        >
      </div>
      <p v-if="!controller.logs.length" class="empty-copy">No DNS responses recorded.</p>
      <div v-else class="dns-log">
        <table>
          <thead
            ><tr
              ><th scope="col">Hostname</th><th scope="col">Address</th><th scope="col">TTL</th></tr
            ></thead
          >
          <tbody
            ><tr v-for="row in controller.logs" :key="row.id"
              ><td>{{ row.host }}</td
              ><td>{{ row.ip }}</td
              ><td>{{ row.ttl }}</td></tr
            ></tbody
          >
        </table>
      </div>
    </article>

    <ForgeDialog v-if="configOpen" wide title="DNS configuration" @close="configOpen = false">
      <div class="dns-config">
        <div class="detail-actions">
          <label
            >Bind address
            <select :value="bind" :disabled="!settings || busy" @change="changeBind">
              <option value="">Use default (all network interfaces)</option>
              <option v-if="bind && !interfaces.some((item) => item.ip === bind)" :value="bind">{{
                bind
              }}</option>
              <option v-for="item in interfaces" :key="item.ip" :value="item.ip">{{
                item.name
              }}</option>
            </select>
          </label>
          <button class="action-button" :disabled="busy || !controller.config" @click="useDefaults"
            >Use defaults</button
          >
          <button class="action-button" :disabled="!controller.config" @click="controller.reveal()"
            >Reveal file</button
          >
        </div>
        <textarea
          v-model="draft"
          aria-label="DNS configuration JSON"
          spellcheck="false"
          :readonly="busy"
        />
        <p
          v-if="controller.error"
          class="forge-alert forge-alert--error dns-message"
          role="alert"
          >{{ controller.error }}</p
        >
      </div>
      <template #footer>
        <button class="action-button" @click="configOpen = false">Close</button>
        <button
          class="primary-button"
          :disabled="busy || draft === original || controller.config?.content !== original"
          @click="save"
          >Save configuration</button
        >
      </template>
    </ForgeDialog>
    <ForgeDialog v-if="clearOpen" title="Clear DNS query log?" @close="clearOpen = false">
      <template #footer>
        <button class="action-button" @click="clearOpen = false">Cancel</button>
        <button class="action-button action-button--danger" @click="clear">Clear log</button>
      </template>
    </ForgeDialog>
  </section>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import ForgeDialog from '../components/ForgeDialog.vue'
  import { dnsServer as controller } from '../dnsServer/state'
  import { navigateNext } from '../state/app'

  const configOpen = ref(false)
  const clearOpen = ref(false)
  const draft = ref('')
  const original = ref('')
  const selectedInterface = ref('')
  const busy = computed(() => Boolean(controller.busy))
  const statusLabel = computed(() => {
    if (controller.busy === 'start') return 'Starting'
    if (controller.busy === 'stop') return 'Stopping'
    if (controller.busy === 'restart') return 'Restarting'
    if (!controller.status) return 'Status unavailable'
    return controller.status.running ? 'Running' : 'Stopped'
  })
  const endpoint = computed(() => {
    const status = controller.status
    if (
      status?.address === '0.0.0.0' &&
      controller.interfaces.some((item) => item.ip === selectedInterface.value)
    ) {
      return selectedInterface.value
    }
    return status?.localIP
  })
  const settings = computed<Record<string, unknown> | undefined>(() => {
    try {
      const content = JSON.parse(draft.value)
      if (!content || typeof content !== 'object' || Array.isArray(content)) return undefined
      return content
    } catch {
      return undefined
    }
  })
  const bind = computed(() => {
    const address = settings.value?.bind
    return typeof address === 'string' ? address : ''
  })
  const interfaces = computed(() => [
    { ip: '0.0.0.0', name: 'All network interfaces' },
    { ip: '127.0.0.1', name: '127.0.0.1 · Loopback' },
    ...controller.interfaces
      .filter((item) => !['0.0.0.0', '127.0.0.1'].includes(item.ip))
      .map((item) => ({ ip: item.ip, name: `${item.ip} · ${item.name}` }))
  ])
  const openConfig = () => {
    if (!controller.config) return
    original.value = controller.config.content
    draft.value = original.value
    configOpen.value = true
  }
  const changeBind = (event: Event) => {
    if (!settings.value || busy.value) return
    const content = { ...settings.value }
    const address = (event.target as HTMLSelectElement).value
    if (address) content.bind = address
    else delete content.bind
    draft.value = JSON.stringify(content, null, 2)
  }
  const useDefaults = () => {
    if (controller.config) draft.value = controller.config.defaults
  }
  const save = async () => {
    if (await controller.save(draft.value, original.value)) configOpen.value = false
  }
  const clear = () => {
    controller.clearLogs()
    clearOpen.value = false
  }
  onMounted(() => {
    void controller.refresh()
  })
</script>

<style scoped>
  .dns-panel {
    margin-bottom: 12px;
    padding: 16px;
  }
  .dns-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
  }
  .dns-panel-header h2 {
    margin: 0;
  }
  .dns-interface {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
  }
  .dns-log {
    overflow: auto;
    max-height: 48vh;
  }
  .dns-log table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }
  .dns-log th,
  .dns-log td {
    padding: 8px;
    border-bottom: 1px solid var(--pqt-border);
    overflow-wrap: anywhere;
  }
  .dns-config {
    display: grid;
    gap: 12px;
  }
  .dns-config textarea {
    min-height: 275px;
    width: 100%;
    padding: 10px;
    font-family: monospace;
  }
  .dns-message {
    white-space: pre-wrap;
  }
</style>
