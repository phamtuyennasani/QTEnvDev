<template>
  <ForgeDialog
    title="Cron expression parser"
    description="Generate portable schedules and inspect the next run times."
    eyebrow="WORKSPACE / CODE"
    wide
    @close="emit('close')"
  >
    <div class="cron-parser-panel">
      <div class="cron-parser-toolbar"
        ><label
          >Mode<select v-model="store.cronMode" @change="store.generate()"
            ><option v-for="mode in store.cronModes" :key="mode.value" :value="mode.value">{{
              mode.label
            }}</option></select
          ></label
        ><label
          >Generate<select v-model="store.generateMode" @change="store.generate()"
            ><option v-for="mode in store.generateModes" :key="mode.value" :value="mode.value">{{
              mode.label
            }}</option></select
          ></label
        ></div
      >
      <div class="cron-parser-grid">
        <section
          ><h3>Generate</h3
          ><div class="cron-fields"
            ><label v-if="store.generateMode === 'everyNMinutes'"
              >Interval<input
                v-model.number="store.intervalMinutes"
                type="number"
                min="1"
                max="59"
                @change="store.generate()" /></label
            ><label v-if="['hourly', 'daily', 'weekly', 'monthly'].includes(store.generateMode)"
              >Minute<input
                v-model.number="store.minute"
                type="number"
                min="0"
                max="59"
                @change="store.generate()" /></label
            ><label v-if="['daily', 'weekly', 'monthly'].includes(store.generateMode)"
              >Hour<input
                v-model.number="store.hour"
                type="number"
                min="0"
                max="23"
                @change="store.generate()" /></label
            ><label v-if="store.generateMode === 'weekly'"
              >Day<input
                v-model.number="store.dayOfWeek"
                type="number"
                min="0"
                max="6"
                @change="store.generate()" /></label
            ><label v-if="store.generateMode === 'monthly'"
              >Day of month<input
                v-model.number="store.dayOfMonth"
                type="number"
                min="1"
                max="31"
                @change="store.generate()" /></label></div
          ><code class="cron-expression">{{ store.expression }}</code
          ><p class="website-help">{{ store.generatedDescription }}</p></section
        >
        <section
          ><h3>Parse</h3
          ><input
            v-model.trim="store.expression"
            placeholder="*/5 * * * *"
            @input="store.parse()"
          /><div class="cron-examples"
            ><button
              v-for="example in store.examples"
              :key="example.expression"
              class="action-button"
              @click="store.useExample(example.expression)"
              >{{ example.label }}</button
            ></div
          ><p v-if="store.detectedMode" class="website-help"
            >Detected {{ store.detectedMode }} · {{ store.fieldHint }}</p
          ></section
        >
      </div>
      <p v-if="store.error" class="forge-alert forge-alert--error">{{ store.error }}</p
      ><div v-else class="cron-results"
        ><b>Next runs</b
        ><code v-for="(run, index) in store.results" :key="index"
          >{{ index + 1 }}. {{ run }}</code
        ></div
      >
    </div>
  </ForgeDialog>
</template>
<script setup lang="ts">
  import ForgeDialog from './ForgeDialog.vue'
  import store from '@/components/Tools/CronParser/store'
  const emit = defineEmits<{ close: [] }>()
</script>
<style scoped>
  .cron-parser-panel {
    display: grid;
    gap: 14px;
  }
  .cron-parser-toolbar,
  .cron-parser-grid,
  .cron-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .cron-parser-panel label {
    display: grid;
    gap: 6px;
    color: var(--pqt-text-muted);
    font-size: 11px;
  }
  .cron-parser-panel input,
  .cron-parser-panel select {
    padding: 9px 10px;
    color: var(--pqt-text);
    background: var(--pqt-canvas);
    border: 1px solid var(--pqt-border-strong);
    border-radius: 7px;
    font: 12px var(--pqt-font-mono);
  }
  .cron-parser-grid section {
    display: grid;
    align-content: start;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--pqt-border);
    border-radius: 8px;
  }
  .cron-parser-grid h3 {
    margin: 0;
    font-size: 12px;
  }
  .cron-expression {
    display: block;
    padding: 10px;
    color: var(--pqt-accent);
    background: #0b1518;
    border-radius: 6px;
  }
  .cron-examples {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .cron-results {
    display: grid;
    gap: 6px;
    max-height: 180px;
    overflow: auto;
  }
  .cron-results code {
    padding: 7px 9px;
    border-bottom: 1px solid var(--pqt-border);
  }
</style>
