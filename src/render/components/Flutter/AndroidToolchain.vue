<template>
  <el-card class="version-manager">
    <template #header>
      <div class="card-header">
        <div class="left">
          <span>Android Toolchain</span>
          <span class="ml-3 text-sm opacity-70">{{ summaryText }}</span>
        </div>
        <el-button link :disabled="loading" @click="fetchReadiness">{{
          I18nT('common.action.refresh')
        }}</el-button>
      </div>
    </template>

    <template #default>
      <div class="h-full w-full overflow-hidden">
        <el-scrollbar class="p-5">
          <el-alert
            v-if="!loading && checks.some((check) => check.key === 'sdk' && check.ok === false)"
            :title="I18nT('flutter.androidSdkNotDetected')"
            type="warning"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ I18nT('flutter.androidSdkInstallHint') }}</p>
            <div class="my-2 flex flex-wrap gap-2">
              <el-button
                link
                type="primary"
                @click="shell.openExternal('https://developer.android.com/studio/install')"
                >{{ I18nT('flutter.installAndroidStudio') }}</el-button
              >
              <el-button
                link
                type="primary"
                @click="shell.openExternal('https://developer.android.com/studio#command-tools')"
                >{{ I18nT('flutter.androidCommandLineTools') }}</el-button
              >
            </div>
            <p>{{ I18nT('flutter.androidSdkAfterInstall') }}</p>
          </el-alert>

          <p v-for="error in errors" :key="error" role="alert">{{ error }}</p>
          <el-descriptions :column="1" border class="mb-4" size="small">
            <el-descriptions-item label="ANDROID_HOME">{{
              env.ANDROID_HOME || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="ANDROID_SDK_ROOT">{{
              env.ANDROID_SDK_ROOT || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="JAVA_HOME">{{
              env.JAVA_HOME || '-'
            }}</el-descriptions-item>
          </el-descriptions>

          <div class="mb-4 flex flex-wrap gap-2">
            <el-button
              size="small"
              :loading="fixing"
              :disabled="controller.fix.unknown"
              @click="runAutoFix('set-sdk-env')"
              >Fix SDK Env</el-button
            >
            <el-button
              size="small"
              :loading="fixing"
              :disabled="controller.fix.unknown"
              @click="runAutoFix('add-platform-tools-path')"
              >Fix PATH (platform-tools)</el-button
            >
            <el-button
              size="small"
              type="primary"
              :loading="fixing"
              :disabled="controller.fix.unknown"
              @click="runAutoFix('all')"
              >Run All Auto-fix</el-button
            >
            <el-button size="small" :disabled="!sdkDir" @click="openSdkDir"
              >Open Android SDK</el-button
            >
          </div>

          <template v-if="loading">
            <div class="pc-report-loading mb-4">
              <div class="pc-report-loading-title">Fetching Android toolchain details...</div>
              <div class="pc-report-skeleton-grid">
                <el-skeleton v-for="i in 8" :key="`toolchain-loading-${i}`" animated>
                  <template #template>
                    <el-skeleton-item variant="text" style="width: 100%; height: 14px" />
                  </template>
                </el-skeleton>
              </div>
            </div>
          </template>
          <template v-else>
            <el-table :data="checks" show-overflow-tooltip>
              <el-table-column label="Status" width="120" align="center">
                <template #default="scope">
                  <el-tag :type="scope.row.ok ? 'success' : 'danger'">
                    {{ scope.row.ok ? 'OK' : 'Missing' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="label" label="Component" width="200"></el-table-column>
              <el-table-column prop="value" label="Detected Value"></el-table-column>
              <el-table-column prop="hint" label="Hint" width="320"></el-table-column>
            </el-table>
          </template>

          <el-card class="mt-4" shadow="never">
            <template #header>
              <div class="card-header">
                <div class="left">
                  <span>ADB Devices</span>
                  <span class="ml-3 text-sm opacity-70">{{ devicesSummaryText }}</span>
                </div>
                <el-button link :disabled="devicesLoading" @click="fetchDevices">{{
                  I18nT('common.action.refresh')
                }}</el-button>
              </div>
            </template>

            <template #default>
              <div class="p-4">
                <div class="text-xs opacity-70 mb-3">ADB: {{ adbPath || '-' }}</div>

                <template v-if="devicesLoading">
                  <div class="pc-report-loading">
                    <div class="pc-report-loading-title">Fetching ADB devices...</div>
                    <div class="model-fit-skeleton-grid">
                      <el-skeleton v-for="i in 6" :key="`devices-loading-${i}`" animated>
                        <template #template>
                          <el-skeleton-item variant="text" style="width: 100%; height: 14px" />
                        </template>
                      </el-skeleton>
                    </div>
                  </div>
                </template>
                <el-table v-else :data="devices" show-overflow-tooltip>
                  <el-table-column label="Device ID" min-width="220">
                    <template #default="scope">
                      <div class="flex items-center gap-2">
                        <span>{{ scope.row.id }}</span>
                        <el-tag
                          v-if="targetDevice && targetDevice === scope.row.id"
                          type="success"
                          size="small"
                          >Target</el-tag
                        >
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column label="Status" width="140" align="center">
                    <template #default="scope">
                      <el-tag :type="deviceStatusTag(scope.row.status)">
                        {{ scope.row.status }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="meta" label="Details"></el-table-column>
                  <el-table-column label="Actions" width="290" align="center">
                    <template #default="scope">
                      <div class="flex items-center justify-center gap-2">
                        <el-button
                          size="small"
                          link
                          :disabled="
                            scope.row.id === targetDevice ||
                            controller.deviceChange.running ||
                            controller.deviceChange.unknown
                          "
                          @click="runDeviceAction('set-target', scope.row)"
                          >Set as Target</el-button
                        >
                        <el-button
                          size="small"
                          link
                          type="warning"
                          :disabled="
                            controller.deviceChange.running || controller.deviceChange.unknown
                          "
                          @click="runDeviceAction('disconnect', scope.row)"
                          >Disconnect</el-button
                        >
                        <el-button size="small" link @click="runDeviceAction('info', scope.row)"
                          >Open Device Info</el-button
                        >
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </template>
          </el-card>

          <el-card class="mt-4" shadow="never">
            <template #header>
              <div class="card-header">
                <div class="left">
                  <span>Flutter Doctor</span>
                  <span class="ml-3 text-sm opacity-70">{{ doctorSummaryText }}</span>
                </div>
                <el-button link :loading="doctorLoading" @click="fetchDoctor">{{
                  I18nT('common.action.refresh')
                }}</el-button>
                <el-button class="button" :disabled="!doctorRaw" link @click="copyDoctorReport"
                  >Copy Report</el-button
                >
              </div>
            </template>

            <template #default>
              <div class="p-4">
                <div class="text-xs opacity-70 mb-3">Flutter: {{ flutterBin || '-' }}</div>
                <el-alert
                  v-if="!doctorLoading && doctorMessage && !doctorItems.length"
                  :title="doctorMessage"
                  type="warning"
                  :closable="false"
                  class="mb-3"
                />
                <template v-if="doctorLoading">
                  <div class="pc-report-loading">
                    <div class="pc-report-loading-title">Running flutter doctor...</div>
                    <div class="model-fit-skeleton-grid">
                      <el-skeleton v-for="i in 6" :key="`doctor-loading-${i}`" animated>
                        <template #template>
                          <el-skeleton-item variant="text" style="width: 100%; height: 14px" />
                        </template>
                      </el-skeleton>
                    </div>
                  </div>
                </template>
                <el-table v-else :data="doctorDisplayItems" show-overflow-tooltip>
                  <template #empty>
                    <span class="text-xs opacity-70"
                      >No parsed doctor checks. Use Copy Report for full output.</span
                    >
                  </template>
                  <el-table-column label="Status" width="140" align="center">
                    <template #default="scope">
                      <el-tag :type="doctorStatusTag(scope.row.status)">
                        {{ scope.row.status }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="title" label="Component" min-width="260"></el-table-column>
                  <el-table-column label="Details">
                    <template #default="scope">
                      <div class="text-xs whitespace-pre-wrap">{{
                        scope.row.details.join('\n') || '-'
                      }}</div>
                    </template>
                  </el-table-column>
                </el-table>
                <el-input
                  v-if="doctorRaw"
                  :model-value="doctorRaw"
                  type="textarea"
                  :rows="8"
                  readonly
                  class="mt-3"
                  placeholder="Flutter doctor raw output"
                ></el-input>
              </div>
            </template>
          </el-card>

          <el-card class="mt-4" shadow="never">
            <template #header>
              <div class="card-header">
                <div class="left">
                  <span>Flutter Quick Actions</span>
                </div>
              </div>
            </template>
            <template #default>
              <div class="p-4">
                <div class="mb-3 flex items-center gap-2">
                  <el-input
                    v-model="projectDir"
                    placeholder="Select Flutter project directory"
                  ></el-input>
                  <el-button @click="chooseProjectDir">Browse</el-button>
                  <el-button style="margin-left: 0" :disabled="!projectDir" @click="openProjectDir"
                    >Open</el-button
                  >
                </div>

                <div class="mb-3 flex flex-wrap gap-2">
                  <el-button
                    size="small"
                    type="primary"
                    :loading="quickRunning"
                    :disabled="controller.command.unknown || !projectDir"
                    @click="runQuickAction('run')"
                    >flutter run</el-button
                  >
                  <el-button
                    size="small"
                    :loading="quickRunning"
                    :disabled="controller.command.unknown || !projectDir"
                    @click="runQuickAction('build-apk')"
                    >flutter build apk</el-button
                  >
                  <el-button
                    size="small"
                    :loading="quickRunning"
                    :disabled="controller.command.unknown || !projectDir"
                    @click="runQuickAction('build-appbundle')"
                    >flutter build appbundle</el-button
                  >
                </div>

                <el-input
                  v-model="quickLog"
                  type="textarea"
                  :rows="12"
                  readonly
                  placeholder="Command output will appear here"
                ></el-input>
              </div>
            </template>
          </el-card>
        </el-scrollbar>
      </div>
    </template>
  </el-card>
</template>

<script lang="ts" setup>
  import { computed, ref, onMounted } from 'vue'
  import { MessageError, MessageSuccess } from '@/util/Element'
  import { clipboard, dialog, shell } from '@/util/NodeFn'
  import { I18nT } from '@lang/index'
  import { ElMessageBox } from 'element-plus'
  import { flutterWorkbench as controller } from './WorkbenchController'

  type DoctorStatus = 'ok' | 'warning' | 'error' | 'unknown'
  const loading = computed(() => controller.readiness.loading)
  const devicesLoading = computed(() => controller.devices.loading)
  const doctorLoading = computed(() => controller.doctor.loading)
  const fixing = computed(() => controller.fix.running)
  const errors = computed(() =>
    [controller.doctor.error, controller.readiness.error, controller.devices.error].filter(Boolean)
  )
  const adbPath = computed(() => controller.devices.data.adbPath)
  const flutterBin = computed(() => controller.doctor.data.flutterBin)
  const doctorMessage = computed(() => controller.doctor.data.message)
  const checks = computed(() => controller.readiness.data.checks)
  const sdkDir = computed(
    () => checks.value.find((item) => item.key === 'sdk' && item.ok)?.value ?? ''
  )
  const targetDevice = computed(() => controller.devices.data.targetDevice)
  const projectDir = ref('')
  const quickRunning = computed(() => controller.command.running)
  const quickLog = computed(() => controller.command.output)
  const devices = computed(() => controller.devices.data.devices)
  const devicesSummary = computed(() => controller.devices.data.summary)
  const doctorItems = computed(() => controller.doctor.data.items)
  const doctorRaw = computed(() => controller.doctor.data.raw)
  const doctorSummary = computed(() => controller.doctor.data.summary)
  const env = computed(() => controller.readiness.data.env)
  const summary = computed(() => controller.readiness.data.summary)
  const summaryText = computed(() => {
    if (!summary.value.total) {
      return 'No data yet'
    }
    return `${summary.value.passed}/${summary.value.total} ready`
  })

  const devicesSummaryText = computed(() => {
    if (!devicesSummary.value.total) {
      return 'No devices'
    }
    return `${devicesSummary.value.online}/${devicesSummary.value.total} online`
  })

  const doctorSummaryText = computed(() => {
    if (!doctorSummary.value.total) {
      return 'No checks'
    }
    return `${doctorSummary.value.ok}/${doctorSummary.value.total} ok, ${doctorSummary.value.warning} warning, ${doctorSummary.value.error} error`
  })

  const doctorDisplayItems = computed(() => {
    if (doctorItems.value.length) {
      return doctorItems.value
    }
    const lines = `${doctorRaw.value ?? ''}`
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => !!l)
      .slice(0, 80)

    return lines.map((line) => ({
      status: 'unknown' as DoctorStatus,
      title: line,
      details: []
    }))
  })

  const deviceStatusTag = (status: string) => {
    if (status === 'device') {
      return 'success'
    }
    if (status === 'offline' || status === 'unauthorized') {
      return 'danger'
    }
    return 'warning'
  }

  const doctorStatusTag = (status: DoctorStatus) => {
    if (status === 'ok') {
      return 'success'
    }
    if (status === 'error') {
      return 'danger'
    }
    if (status === 'warning') {
      return 'warning'
    }
    return 'info'
  }

  const fetchReadiness = () => controller.fetchReadiness()
  const fetchDevices = () => controller.fetchDevices()
  const fetchDoctor = () => controller.fetchDoctor()
  const runDeviceAction = async (
    action: 'set-target' | 'disconnect' | 'info',
    row: { id: string }
  ) => {
    if (action !== 'info') {
      await controller.runDeviceAction(action, row.id)
      return
    }
    if (controller.deviceInfo.loading) return
    await controller.deviceInfo.refresh('androidDeviceAction', ['info', row.id])
    if (controller.deviceInfo.error) return MessageError(controller.deviceInfo.error)
    const data = controller.deviceInfo.data
    await ElMessageBox.alert(
      'State: ' + data.state + '\n\n' + data.details,
      'Device Info - ' + row.id,
      { confirmButtonText: 'OK' }
    ).catch(() => {})
  }
  const copyDoctorReport = () => {
    if (!doctorRaw.value) {
      return
    }
    clipboard.writeText(doctorRaw.value)
    MessageSuccess(I18nT('base.copySuccess'))
  }

  const openSdkDir = () => {
    if (!sdkDir.value) {
      return
    }
    shell.openPath(sdkDir.value).catch(() => {
      MessageError('Failed to open Android SDK path')
    })
  }

  const runAutoFix = (action: string) => controller.runAutoFix(action)
  const chooseProjectDir = async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory', 'showHiddenFiles']
    })
    if (!canceled && filePaths?.length) {
      projectDir.value = filePaths[0]
    }
  }

  const openProjectDir = () => {
    if (!projectDir.value) {
      return
    }
    shell.openPath(projectDir.value).catch(() => {
      MessageError('Failed to open project directory')
    })
  }

  const runQuickAction = (action: string) => controller.runQuickAction(action, projectDir.value)
  onMounted(() => {
    void Promise.allSettled([fetchReadiness(), fetchDevices(), fetchDoctor()])
  })
</script>

<style scoped>
  .pc-report-loading {
    border: 1px dashed rgba(148, 163, 184, 0.35);
    border-radius: 8px;
    padding: 12px;
    background: rgba(30, 41, 59, 0.18);
  }

  .pc-report-loading-title {
    font-size: 12px;
    color: #94a3b8;
    margin-bottom: 10px;
  }

  .pc-report-skeleton-grid {
    display: grid;
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 8px;
  }

  .model-fit-skeleton-grid {
    display: grid;
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 8px;
  }

  @media (min-width: 768px) {
    .pc-report-skeleton-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 20px;
    }

    .model-fit-skeleton-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px 14px;
    }
  }
</style>
