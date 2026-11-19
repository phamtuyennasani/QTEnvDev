<template>
  <el-card class="w-full h-full overflow-hidden p-3 app-base-el-card">
    <Create @on-make-host="onMakeHost" />
  </el-card>
</template>

<script lang="ts" setup>
  import Create from '@/components/Host/CreateProject/php.vue'
  import { useAsyncComponentShow } from '@/util/AsyncComponent'
  import { MessageError } from '@/util/Element'

  const props = defineProps<{ websiteEditor?: 'parent' }>()
  const emit = defineEmits<{ scaffoldWebsite: [project: { dir: string; rewrite: string }] }>()
  const showDialog = useAsyncComponentShow()
  const onMakeHost = async (res: { dir: string; rewrite: string }) => {
    if (props.websiteEditor === 'parent') {
      emit('scaffoldWebsite', res)
      return
    }
    const snapshot = {
      edit: {
        root: res.dir,
        nginx: {
          rewrite: res.rewrite
        }
      }
    }
    try {
      const { default: component } = await import('@/components/Host/Edit.vue')
      await showDialog(component, snapshot)
    } catch (error) {
      MessageError(String(error))
    }
  }
</script>
