import { reactive } from 'vue'
import type { CronJob, CronRunRecord, SystemScheduledTask } from '@shared/app'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'
import { validatePortableCronExpression } from '@shared/CronExpression'
import { CRON_OUTCOME_UNKNOWN, CRON_SYSTEM_TASK_REMOVED, type CronCommandResult } from '../../fork/module/Cron/types'
import { showNotice } from './app'
type Outcome = {
  status: 'running' | 'succeeded' | 'partial' | 'failed' | 'unknown'
  message: string
  command?: CronCommandResult
}

const state = reactive({
  jobs: [] as CronJob[],
  outcomes: {} as Record<string, Outcome>,
  loading: false,
  busy: false,
  unknown: false,
  error: ''
})
const system = reactive({
  tasks: [] as SystemScheduledTask[],
  loading: false,
  verified: false,
  error: '',
  result: ''
})
const histories = reactive<Record<string, { records: CronRunRecord[]; loading: boolean; error: string }>>({})
const draftRun = reactive<{ editorId?: number; outcome?: Outcome }>({})
let lastEditorId = 0
const newEditorId = () => ++lastEditorId
let loadFlight: Promise<boolean> | undefined
const request = (method: string, args: unknown[] = []) =>
  forkTerminalRequest('app-fork:cron', [method, ...args], 'The scheduler did not return a result.', 120_000)
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)
const taskKey = (job: CronJob) => JSON.stringify([job.hostId ?? 0, job.id])
const isCommandResult = (data: unknown): data is CronCommandResult => {
  if (!data || typeof data !== 'object') return false
  const result = data as Partial<CronCommandResult>
  return Number.isInteger(result.exitCode) && typeof result.output === 'string' && typeof result.error === 'string'
}
const testCommand = async (editorId: number, command: string, workDir: string) => {
  if (state.busy || state.loading || state.unknown || system.loading || !command.trim()) return
  state.busy = true
  draftRun.editorId = editorId
  draftRun.outcome = { status: 'running', message: 'Running the command…' }
  const unknown = (message: string): Outcome => {
    state.unknown = true
    return { status: 'unknown', message }
  }
  try {
    const reply = await request('runCommand', [workDir, command])
    if (reply.errorCode === CRON_OUTCOME_UNKNOWN) {
      draftRun.outcome = unknown(reply.msg || 'The test run could not be verified.')
    } else if (reply.code !== 0) {
      draftRun.outcome = { status: 'failed', message: reply.msg || 'Could not test the command.' }
    } else if (!isCommandResult(reply.data)) {
      draftRun.outcome = unknown('The scheduler did not report the result of the test run.')
    } else {
      draftRun.outcome = {
        status: reply.data.exitCode === 0 ? 'succeeded' : 'failed',
        message: 'Test command exited with code ' + reply.data.exitCode + '.',
        command: reply.data
      }
    }
  } catch (error) {
    draftRun.outcome = unknown(errorText(error))
  } finally {
    state.busy = false
  }
  showNotice(draftRun.outcome.message)
}
const refresh = async () => {
  state.loading = true
  state.error = ''
  try {
    const result = await request('getCronJobs')
    if (result.code !== 0 || !Array.isArray(result.data)) {
      throw new Error(result.msg || 'The scheduler did not return its task list.')
    }
    state.jobs = result.data
    return true
  } catch (error) {
    state.error = errorText(error)
    return false
  } finally {
    state.loading = false
  }
}
const load = (fromMutation = false) => {
  if (state.busy && !fromMutation) return Promise.resolve(false)
  loadFlight ??= refresh().finally(() => { loadFlight = undefined })
  return loadFlight
}
const mutate = async (key: string, method: string, args: unknown[]) => {
  if (state.busy || state.loading || state.unknown || system.loading) return false
  state.busy = true
  if (method !== 'runJobNow') system.verified = false
  state.error = ''
  state.outcomes[key] = { status: 'running', message: 'Waiting for scheduler…' }
  const finishUnknown = (message: string) => {
    state.unknown = true
    state.outcomes[key] = { status: 'unknown', message }
    state.error = message + ' Check the task before reopening the app to retry.'
    return false
  }
  try {
    let result
    try {
      result = await request(method, args)
    } catch (error) {
      return finishUnknown(errorText(error))
    }
    if (result.errorCode === CRON_OUTCOME_UNKNOWN) {
      return finishUnknown(result.msg || 'The scheduler result could not be verified.')
    }
    if (result.code !== 0) {
      state.outcomes[key] = { status: 'failed', message: result.msg || 'The scheduler rejected the operation.' }
      state.error = state.outcomes[key].message
      return false
    }
    const data = result.data
    const wasRun = method === 'runJobNow'
    const deleted = method === 'deleteCronJob'
    if (wasRun ? !isCommandResult(data) : deleted ? data !== true : typeof data?.id !== 'string') {
      return finishUnknown('The scheduler did not return the operation result.')
    }
    const command: CronCommandResult | undefined = wasRun ? data : undefined
    const failed = Boolean(command && command.exitCode !== 0)
    const partial = Boolean(command?.historyWarning || data?.systemError)
    const message = command
      ? ['Command exited with code ' + command.exitCode + '.', command.historyWarning].filter(Boolean).join(' ')
      : data?.systemError
        ? 'Task saved, but schedule registration failed. ' + data.systemError
        : deleted ? 'Task deleted.' : 'Task saved.'
    const outcome: Outcome = {
      status: failed ? 'failed' : partial ? 'partial' : 'succeeded',
      message,
      command
    }
    state.outcomes[key] = outcome
    if (deleted) {
      state.jobs = state.jobs.filter((job) => taskKey(job) !== key)
    } else if (!wasRun) {
      const newKey = taskKey(data)
      state.outcomes[newKey] = outcome
      const existingIndex = state.jobs.findIndex((job) => [key, newKey].includes(taskKey(job)))
      if (existingIndex < 0) state.jobs.unshift(data)
      else state.jobs.splice(existingIndex, 1, data)
    }
    if (!await load(true) && state.error) showNotice(outcome.message + ' Task list refresh failed.')
    return !failed
  } finally {
    state.busy = false
  }
}
const toggle = (job: CronJob) => mutate(taskKey(job), 'toggleCronJob', [job.hostId ?? 0, job.id, !job.enabled])
const run = (job: CronJob) => mutate(taskKey(job), 'runJobNow', [job.hostId ?? 0, job.id, job.workDir ?? ''])
const remove = (job: CronJob) => mutate(taskKey(job), 'deleteCronJob', [job.hostId ?? 0, job.id])
const historyFor = (job: CronJob) => histories[taskKey(job)]
const loadHistory = async (job: CronJob) => {
  const key = taskKey(job)
  const id = job.id
  if (histories[key]?.loading) return
  histories[key] ??= { records: [], loading: false, error: '' }
  const history = histories[key]
  history.loading = true
  history.error = ''
  try {
    const result = await request('listRunRecords', [id, 20])
    if (result.code !== 0 || !Array.isArray(result.data)) throw new Error(result.msg || 'Could not load run history.')
    history.records = (result.data as CronRunRecord[]).filter((record) => record?.jobId === id).reverse()
  } catch (error) {
    history.error = errorText(error)
  } finally {
    history.loading = false
  }
}
const loadSystem = async (fromMutation = false) => {
  if (system.loading || (state.busy && !fromMutation)) return false
  system.loading = true
  system.verified = false
  system.error = ''
  try {
    const result = await request('listSystemTasks')
    if (result.code !== 0 || !Array.isArray(result.data)) throw new Error(result.msg || 'Could not load the system scheduler.')
    system.tasks = result.data
    system.verified = true
    return true
  } catch (error) {
    system.error = errorText(error)
    return false
  } finally {
    system.loading = false
  }
}
const isCurrentSystemTask = (task: SystemScheduledTask) => system.verified && system.tasks.includes(task)
const removeSystem = async (task: SystemScheduledTask) => {
  if (state.busy || state.loading || state.unknown || !isCurrentSystemTask(task)) return false
  const { id, isQTEnvDev } = task
  state.busy = true
  system.result = ''
  system.error = ''
  try {
    let result
    try {
      result = await request('deleteSystemTask', [id])
    } catch (error) {
      state.unknown = true
      system.verified = false
      system.error = errorText(error)
      return false
    }
    const metadataFailed = result.errorCode === CRON_SYSTEM_TASK_REMOVED
    if (!metadataFailed && result.code !== 0) {
      system.error = result.msg || 'Could not remove the system task.'
      if (result.errorCode === CRON_OUTCOME_UNKNOWN) {
        state.unknown = true
        system.verified = false
      }
      return false
    }
    if (!metadataFailed && result.data !== true) {
      state.unknown = true
      system.verified = false
      system.error = 'The scheduler did not confirm the removal.'
      return false
    }
    system.tasks = system.tasks.filter((item) => item.id !== id)
    const [systemRefreshed, jobsRefreshed] = await Promise.all([
      loadSystem(true),
      isQTEnvDev ? load(true) : Promise.resolve(true)
    ])
    system.result = metadataFailed ? result.msg || 'System task removed. Its app record could not be updated.' : 'System task removed.'
    if (!systemRefreshed || !jobsRefreshed) system.result += ' A task list could not be refreshed.'
    showNotice(system.result)
    return true
  } finally {
    state.busy = false
  }
}
const save = (draft: Partial<CronJob>, existing?: CronJob) => {
  const schedule = String(draft.schedule ?? '').trim()
  const validation = validatePortableCronExpression(schedule)
  let error = ''
  if (!validation.valid) error = validation.error || 'The schedule is invalid.'
  else if (!draft.name?.trim() || !draft.command?.trim()) error = 'Name and command are required.'
  else if (draft.scope === 'host' && (!Number.isSafeInteger(draft.hostId) || !draft.hostId || draft.hostId < 1)) {
    error = 'Choose a website before saving a website task.'
  }
  if (error) {
    state.error = error
    return Promise.resolve(false)
  }
  const snapshot = {
    ...draft,
    name: draft.name?.trim(),
    schedule,
    hostId: draft.scope === 'host' ? draft.hostId : undefined,
    enabled: draft.enabled ?? existing?.enabled ?? true
  }
  return existing
    ? mutate(taskKey(existing), 'updateCronJob', [existing.hostId ?? 0, existing.id, snapshot])
    : mutate('new', 'addCronJob', [snapshot.hostId ?? 0, snapshot])
}
export const cronController = {
  state, load, toggle, run, remove, save, taskKey,
  system, loadSystem, isCurrentSystemTask, removeSystem, historyFor, loadHistory,
  draftRun, newEditorId, testCommand,
  clearError: () => { state.error = '' },
  outcome: (job: CronJob) => state.outcomes[taskKey(job)]
}
