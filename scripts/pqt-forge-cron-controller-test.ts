import assert from 'node:assert/strict'
import type { CronJob, CronRunRecord, SystemScheduledTask } from '../src/shared/app'
import * as schedule from '../src/shared/CronExpression'
import { CRON_OUTCOME_UNKNOWN, CRON_SYSTEM_TASK_REMOVED } from '../src/fork/module/Cron/types'
import { loadIsolated } from './helpers/load-isolated'

type Reply = { code: number; data?: unknown; msg?: string; errorCode?: string }
const replies: Array<{ args: unknown[]; finish(result: Reply): void }> = []
const notices: string[] = []
const { cronController: controller } = await loadIsolated('src/render-next/state/cronController.ts', {
  '@/util/ForkTerminalRequest': {
    forkTerminalRequest: (_channel: string, args: unknown[]) =>
      new Promise((finish: (result: Reply) => void) => { replies.push({ args, finish }) })
  },
  '@shared/CronExpression': schedule,
  '../../fork/module/Cron/types': { CRON_OUTCOME_UNKNOWN, CRON_SYSTEM_TASK_REMOVED },
  './app': { showNotice: (notice: string) => notices.push(notice) }
})
const job: CronJob = {
  id: 'website-job', hostId: 17, scope: 'host', name: 'Backup', schedule: '0 2 * * *',
  command: 'backup', enabled: true, createdAt: 0, updatedAt: 0
}
assert.equal(await controller.save({ ...job, schedule: '0 2' }), false)
assert.equal(replies.length, 0)

const loading = controller.load()
assert.equal(loading, controller.load())
assert.equal(await controller.remove(job), false)
replies.shift()!.finish({ code: 0, data: [job] })
assert.equal(await loading, true)

const running = controller.run(job)
assert.equal(await controller.run(job), false)
const run = replies.shift()!
assert.deepEqual(Array.from(run.args), ['runJobNow', 17, 'website-job', ''])
run.finish({ code: 0, data: { exitCode: 7, output: 'Started', error: 'Backup failed', duration: 80 } })
await new Promise((resolve) => setImmediate(resolve))
replies.shift()!.finish({ code: 1, msg: 'Refresh failed' })
assert.equal(await running, false)
assert.equal(controller.outcome(job).command.exitCode, 7)
assert.equal(controller.outcome(job).command.output, 'Started')
assert.match(notices.at(-1) ?? '', /code 7.*refresh failed/i)

const creating = controller.save({ ...job, id: undefined })
const create = replies.shift()!
assert.equal(create.args[1], 17)
const created = { ...job, id: 'new-job', systemError: 'Operating system rejected the schedule.' }
create.finish({ code: 0, data: created })
await new Promise((resolve) => setImmediate(resolve))
replies.shift()!.finish({ code: 1, msg: 'Refresh failed' })
assert.equal(await creating, true)
assert.equal(controller.outcome(created).status, 'partial')
assert(controller.state.jobs.some((item: CronJob) => item.id === created.id))

const firstHistory = controller.loadHistory(job)
const secondHistory = controller.loadHistory(created)
await controller.loadHistory(job)
const [firstRead, secondRead] = replies.splice(0)
assert.deepEqual(Array.from(firstRead.args), ['listRunRecords', job.id, 20])
assert.deepEqual(Array.from(secondRead.args), ['listRunRecords', created.id, 20])
const record = (jobId: string, time: number): CronRunRecord => ({
  id: jobId + time, jobId, startedAt: time, finishedAt: time, duration: 0, exitCode: 0
})
secondRead.finish({ code: 0, data: [record(created.id, 3)] })
await secondHistory
assert.equal(controller.historyFor(job).loading, true)
firstRead.finish({ code: 0, data: [record(job.id, 1), record(created.id, 2), record(job.id, 3)] })
await firstHistory
assert.deepEqual(Array.from(controller.historyFor(job).records, (item: CronRunRecord) => item.finishedAt), [3, 1])
assert.deepEqual(Array.from(controller.historyFor(created).records, (item: CronRunRecord) => item.finishedAt), [3])
const retryHistory = controller.loadHistory(created)
replies.shift()!.finish({ code: 1, msg: 'Run log unavailable' })
await retryHistory
assert.equal(controller.historyFor(created).error, 'Run log unavailable')
assert.equal(controller.historyFor(created).records.length, 1)

const systemTask: SystemScheduledTask = {
  id: '\\QTEnvDev-Cron-website-job', name: 'Backup', fullName: '\\QTEnvDev-Cron-website-job',
  platform: 'windows', isQTEnvDev: true
}
const otherTask: SystemScheduledTask = { ...systemTask, id: '\\Other\\Backup', isQTEnvDev: false }
const refreshSystem = async () => {
  const loading = controller.loadSystem()
  replies.shift()!.finish({ code: 0, data: [{ ...systemTask }, { ...otherTask }] })
  assert.equal(await loading, true)
}
await refreshSystem()
const staleTask = controller.system.tasks[0]
await refreshSystem()
assert.equal(await controller.removeSystem(staleTask), false)
assert.equal(replies.length, 0)
const currentTask = controller.system.tasks[0]
const deletingSystem = controller.removeSystem(currentTask)
assert.equal(await controller.removeSystem(currentTask), false)
assert.equal(await controller.toggle(job), false)
const systemDelete = replies.shift()!
assert.deepEqual(Array.from(systemDelete.args), ['deleteSystemTask', systemTask.id])
systemDelete.finish({ code: 1, errorCode: CRON_SYSTEM_TASK_REMOVED, msg: 'System task removed, but app record was not updated.' })
await new Promise((resolve) => setImmediate(resolve))
assert.deepEqual(replies.map((reply) => reply.args[0]), ['listSystemTasks', 'getCronJobs'])
replies.shift()!.finish({ code: 1, msg: 'System scheduler unavailable' })
replies.shift()!.finish({ code: 1, msg: 'Task list unavailable' })
assert.equal(await deletingSystem, true)
assert.match(controller.system.result, /removed.*app record.*could not be refreshed/i)
assert.deepEqual(Array.from(controller.system.tasks, (item: SystemScheduledTask) => item.id), [otherTask.id])
assert.equal(controller.system.verified, false)
assert.equal(await controller.removeSystem(currentTask), false)
assert.equal(await controller.removeSystem(controller.system.tasks[0]), false)
assert.equal(replies.length, 0)

const unsure = controller.remove(job)
replies.shift()!.finish({ code: 1, errorCode: CRON_OUTCOME_UNKNOWN, msg: 'Task details were not saved.' })
assert.equal(await unsure, false)
assert.equal(controller.outcome(job).status, 'unknown')
assert.equal(await controller.remove(job), false)
assert.equal(replies.length, 0)

let readFailure: { code: number; stderr: string } | undefined = { code: 1, stderr: 'crontab: Permission denied' }
const cronCommands: string[] = []
const { UnixSystemScheduler } = await loadIsolated('src/fork/module/Cron/UnixSystemScheduler.ts', {
  '@shared/EnvSync': {},
  '@shared/utils': {},
  './utils': { shellQuote: (arg: string) => "'" + arg + "'", taskScriptPath: () => '/fixture/task.sh' },
  '../../Fn': {
    execPromise: async (command: string) => {
      cronCommands.push(command)
      if (command === 'crontab -l' && readFailure) throw readFailure
      return { stdout: '# QTEnvDev Cron Start backup\n0 2 * * * backup\n# QTEnvDev Cron End backup\n' }
    },
    readFile: async () => '',
    writeFile: async () => {},
    remove: async () => {},
    uuid: () => 'fixture'
  }
})
const unixScheduler = new UnixSystemScheduler('/fixture')
await assert.rejects(unixScheduler.deleteSystemTask('qtenvdev:backup'), (error) => error === readFailure)
assert.deepEqual(cronCommands, ['crontab -l'])
readFailure = { code: 1, stderr: 'crontab: no crontab for fixture' }
assert.deepEqual(Array.from(await unixScheduler.listSystemTasks()), [])
readFailure = undefined
await unixScheduler.deleteSystemTask('qtenvdev:backup')
assert.equal(cronCommands.filter((command) => command !== 'crontab -l').length, 1)
console.log('Scheduled tasks passed: terminal outcomes, isolated run histories, stale rows, and no replay after partial deletion or an unknown write. Unreadable crontabs are preserved.')
