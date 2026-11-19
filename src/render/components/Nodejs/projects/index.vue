<template>
  <ProjectIndex :type-flag="'node'" :title="I18nT('host.projectNode')">
    <template #operation="{ row }">
      <li @click.stop="showPackage(row)">
        <Reading width="13" height="13" />
        <span class="ml-3">package.json</span>
      </li>
    </template>
  </ProjectIndex>
</template>

<script lang="ts" setup>
  import { I18nT } from '@lang/index'
  import { Reading } from '@element-plus/icons-vue'
  import { useAsyncComponentShow } from '@/util/AsyncComponent'
  import { MessageError } from '@/util/Element'
  import ProjectIndex from '@/components/LanguageProjects/index.vue'
  import type { ProjectItem } from '@/components/LanguageProjects/ProjectItem'

  const showDialog = useAsyncComponentShow()
  const showPackage = async (item: ProjectItem) => {
    try {
      const { default: component } = await import('./package.vue')
      await showDialog(component, { item })
    } catch (error) {
      MessageError(String(error))
    }
  }
</script>
