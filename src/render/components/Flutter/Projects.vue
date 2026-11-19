<template>
  <div class="flutter-projects">
    <CreateProject v-model="createOpen" />
    <EditProject v-model="editOpen" :project-path="editingPath" />
    <ProjectIndex :title="I18nT('host.projectFlutter')" type-flag="flutter" hide-default-edit>
      <template #header-actions>
        <el-button link @click="createOpen = true">{{ I18nT('host.newProject') }}</el-button>
      </template>
      <template #operation="{ row }">
        <li @click.stop="openEditor(row.path)">
          <yb-icon :svg="import('@/svg/edit.svg?raw')" width="13" height="13" />
          <span class="ml-3">{{ I18nT('common.action.edit') }} (Flutter)</span>
        </li>
      </template>
    </ProjectIndex>
  </div>
</template>

<script lang="ts" setup>
  import { ref } from 'vue'
  import { I18nT } from '@lang/index'
  import ProjectIndex from '@/components/LanguageProjects/index.vue'
  import CreateProject from './CreateProject.vue'
  import EditProject from './EditProject.vue'

  const createOpen = ref(false)
  const editOpen = ref(false)
  const editingPath = ref('')

  const openEditor = (path: string) => {
    editingPath.value = path
    editOpen.value = true
  }
</script>

<style scoped>
  .flutter-projects {
    height: 100%;
    min-height: 0;
  }
</style>
