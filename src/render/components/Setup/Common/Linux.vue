<template>
  <div class="row-2">
    <div class="col">
      <AutoLanch />
    </div>
    <div class="col">
      <AutoHide />
    </div>
  </div>
  <div class="row-2">
    <div class="col">
      <TrayStyle />
    </div>
    <div class="col">
      <QTEnvDevHelperFix />
    </div>
  </div>
</template>

<script lang="ts" setup>
  import AutoLanch from '../AutoLanch/index.vue'
  import AutoHide from '../AutoHide/index.vue'
  import TrayStyle from '../TrayStyle/index.vue'
  import QTEnvDevHelperFix from '../QTEnvDevHelper/index.vue'
</script>
