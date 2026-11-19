<template>
  <ForgeDialog
    :title="original ? 'Configure website' : 'Create website'"
    :description="
      directProject
        ? 'Save the endpoint for a local runtime project.'
        : 'Save a local host and generate web server configuration.'
    "
    eyebrow="WORKSPACE / WEBSITES"
    wide
    @close="emit('close')"
  >
    <form id="website-editor" class="website-form" @submit.prevent="submit">
      <nav v-if="!directProject" class="website-editor-tabs" aria-label="Website settings"
        ><button
          v-for="item in tabs"
          :key="item"
          type="button"
          :class="{ active: tab === item }"
          @click="tab = item"
          >{{ item }}</button
        ></nav
      >
      <p v-if="projectController.error" class="forge-alert forge-alert--error" role="alert">{{
        projectController.error
      }}</p>
      <template v-if="tab === 'General'">
        <div class="website-form-grid"
          ><label
            >Project name<input
              v-model="form.projectName"
              autofocus
              placeholder="My application" /></label
          ><label
            >Primary hostname<input v-model="form.name" placeholder="app.test" required /></label
        ></div>
        <label
          >Aliases <span>One hostname per line</span
          ><textarea v-model="form.alias" rows="2" placeholder="www.app.test" />
        </label>
        <label
          >Project root<div class="website-path"
            ><input v-model="form.root" placeholder="C:/Projects/my-app/public" required /><button
              type="button"
              class="action-button"
              @click="choose('root')"
              >Browse</button
            ></div
          ></label
        >
        <label
          >Site runtime<select
            v-model="form.type"
            :disabled="Boolean(original)"
            @change="setRuntime"
            ><option value="php">PHP / static</option
            ><option value="node">Node.js project</option
            ><option value="python">Python project</option
            ><option value="go">Go project</option
            ><option value="java">Java Spring Boot</option></select
          ></label
        >
        <label v-if="!directProject"
          >PHP version<select v-model="form.phpVersion" @change="setPhp"
            ><option :value="undefined">Static website · no PHP</option
            ><option
              v-if="form.phpVersion && !phpVersions.some((item) => item.num === form.phpVersion)"
              :value="form.phpVersion"
              >{{ form.phpVersionFull || form.phpVersion }} · saved version unavailable</option
            ><option v-for="version in phpVersions" :key="version.num" :value="version.num">{{
              version.version
            }}</option></select
          ></label
        >
        <template v-else
          ><label
            >Project runtime port<input
              v-model.number="form.projectPort"
              type="number"
              min="1"
              max="65535"
              required
              placeholder="3000" /></label
          ><label
            >Start command<input v-model="form.startCommand" /></label
        ></template>
        <label v-if="!directProject" class="website-toggle">
          <span>
            <b>Create websites from subdirectories</b>
            <small>For example, the blog folder in app.test becomes blog.app.test.</small>
          </span>
          <input v-model="includeSubdirectories" type="checkbox" />
        </label>
        <p v-else class="website-help"
          >Runtime settings describe the project endpoint. Use its runtime project screen to manage
          the process.</p
        >
        <label>Notes<input v-model="form.mark" placeholder="Optional project notes" /></label>
      </template>
      <template v-else-if="tab === 'Ports'">
        <p class="website-help"
          >Listening ports are stored separately for each web server. Keep existing values unless
          you intend to change the endpoint.</p
        >
        <div class="website-ports"
          ><b>Web server</b><b>HTTP</b><b>HTTPS</b
          ><template v-for="server in servers" :key="server.flag"
            ><span>{{ server.label }}</span
            ><input
              v-model.number="form.port[server.flag]"
              type="number"
              min="1"
              max="65535"
              :aria-label="server.label + ' HTTP port'" /><input
              v-model.number="form.port[server.ssl]"
              type="number"
              min="1"
              max="65535"
              :disabled="!form.useSSL"
              :aria-label="server.label + ' HTTPS port'" /></template
        ></div>
      </template>
      <template v-else-if="tab === 'SSL'">
        <label class="website-toggle"
          ><span
            ><b>Enable HTTPS</b><small>Generate TLS configuration for this website.</small></span
          ><input v-model="form.useSSL" type="checkbox"
        /></label>
        <template v-if="form.useSSL"
          ><label class="website-toggle"
            ><span
              ><b>Automatic certificate</b
              ><small>Use the existing local certificate provider.</small></span
            ><input v-model="form.autoSSL" type="checkbox" /></label
          ><template v-if="!form.autoSSL"
            ><label
              >Certificate file<div class="website-path"
                ><input v-model="form.ssl.cert" placeholder="Certificate path" /><button
                  type="button"
                  class="action-button"
                  @click="choose('cert')"
                  >Browse</button
                ></div
              ></label
            ><label
              >Private key file<div class="website-path"
                ><input v-model="form.ssl.key" placeholder="Private key path" /><button
                  type="button"
                  class="action-button"
                  @click="choose('key')"
                  >Browse</button
                ></div
              ></label
            ></template
          ><LocalCertificateHelp v-if="form.autoSSL" /><p class="website-help"
            >Certificate issuance or system hosts changes may request system permissions. HTTP and
            HTTPS ports can be changed in Ports.</p
          ></template
        >
      </template>
      <template v-else-if="tab === 'Routing'">
        <NginxRewriteField v-model="form.nginx.rewrite" :disabled="busy" />
        <div class="website-section-heading"
          ><b>Reverse proxies</b
          ><button
            type="button"
            class="text-button"
            @click="addProxy"
            >Add proxy</button
          ></div
        >
        <p v-if="!form.reverseProxy?.length" class="website-help"
          >No reverse proxy routes configured.</p
        >
        <div v-for="(proxy, index) in form.reverseProxy" :key="index" class="website-proxy"
          ><label>Path<input v-model="proxy.path" placeholder="/" /></label
          ><label
            >Upstream URL<input v-model="proxy.url" placeholder="http://127.0.0.1:3000" /></label
          ><button
            type="button"
            class="action-button"
            :aria-label="'Remove proxy ' + (index + 1)"
            @click="form.reverseProxy?.splice(index, 1)"
            >×</button
          ></div
        >
      </template>
      <p v-if="busy" class="forge-alert" role="status"
        >{{ projectController.operation?.message }} You may close this dialog; saving continues.</p
      >
    </form>
    <template #footer
      ><span class="website-help">Project files are preserved.</span
      ><div class="detail-actions"
        ><button class="action-button" @click="emit('close')">Close</button
        ><button form="website-editor" type="submit" class="primary-button" :disabled="busy">{{
          busy ? 'Saving…' : 'Save website'
        }}</button></div
      ></template
    >
  </ForgeDialog>
</template>
<script setup lang="ts">
  import LocalCertificateHelp from './LocalCertificateHelp.vue'
  import NginxRewriteField from './NginxRewriteField.vue'
  import { computed, ref } from 'vue'
  import { isDirectProjectSite } from '@shared/siteRuntime'
  import { BrewStore } from '@/store/brew'
  import ForgeDialog from '../components/ForgeDialog.vue'
  import { projectController } from '../state/projectController'
  import { cloneHost, newWebsite } from './model'
  import type { WebsiteHost } from './types'
  const props = defineProps<{
    original?: WebsiteHost
    scaffold?: { dir: string; rewrite: string }
  }>()
  const emit = defineEmits<{ close: [] }>()
  const form = ref(props.original ? cloneHost(props.original) : newWebsite())
  if (!props.original && props.scaffold) {
    form.value.root = props.scaffold.dir
    form.value.nginx.rewrite = props.scaffold.rewrite
  }
  const directProject = computed(() => isDirectProjectSite(form.value))
  const tabs = ['General', 'Ports', 'SSL', 'Routing'] as const
  const tab = ref<(typeof tabs)[number]>('General')
  const includeSubdirectories = ref(false)
  const busy = computed(() => projectController.saving)
  const phpVersions = computed(() => {
    const versions = BrewStore()
      .module('php')
      .installed.filter((item) => item.num && item.version)
    return versions.filter(
      (item, index) => versions.findIndex((candidate) => candidate.num === item.num) === index
    )
  })
  const servers = [
    { label: 'Nginx', flag: 'nginx', ssl: 'nginx_ssl' },
    { label: 'Apache', flag: 'apache', ssl: 'apache_ssl' },
    { label: 'Caddy', flag: 'caddy', ssl: 'caddy_ssl' },
    { label: 'FrankenPHP', flag: 'frankenphp', ssl: 'frankenphp_ssl' }
  ] as const
  const choose = async (field: 'root' | 'cert' | 'key') => {
    const path = await projectController.choosePath(
      field !== 'root',
      field === 'root' ? form.value.root : form.value.ssl[field]
    )
    if (path) {
      if (field === 'root') form.value.root = path
      else form.value.ssl[field] = path
    }
  }
  const setPhp = () => {
    form.value.phpVersionFull = phpVersions.value.find(
      (item) => item.num === form.value.phpVersion
    )?.version
  }
  const setRuntime = () => {
    includeSubdirectories.value = false
    form.value.subType = form.value.type === 'java' ? 'springboot' : undefined
  }
  const addProxy = () => {
    const proxies = (form.value.reverseProxy ??= [])
    proxies.push({ path: '/', url: 'http://127.0.0.1:3000' })
  }
  const submit = async () => {
    if (await projectController.save(form.value, props.original, includeSubdirectories.value))
      emit('close')
  }
</script>
