<template><div class="tool-panel playground-panel"><header class="tool-panel-header"><div><p class="eyebrow">CODE / PLAYGROUND</p><h2>Code playground</h2></div><button class="icon-button" @click="emit('close')">×</button></header><div class="playground-toolbar"><select v-model="controller.state.language"><option v-for="lang in languages" :key="lang" :value="lang">{{lang}}</option></select><button class="action-button action-button--primary" :disabled="controller.state.running" @click="controller.run()">{{controller.state.running?'Running...':'Run'}}</button><button class="action-button" @click="controller.clear()">Clear output</button></div><textarea v-model="controller.state.code" class="playground-editor" spellcheck="false"></textarea><p v-if="controller.state.error" class="forge-alert forge-alert--error">{{controller.state.error}}</p><div class="playground-output"><p class="eyebrow">OUTPUT</p><pre>{{controller.state.output||'No output yet.'}}</pre></div></div></template>
<script setup lang="ts">
import { codePlaygroundController } from '../state/codePlaygroundController'
const controller = codePlaygroundController
const emit = defineEmits<{ close: [] }>()
const languages = ['javascript','typescript','python','php','ruby','perl','golang','rust']
</script>
