import assert from 'node:assert/strict'
import type { CronJob } from '../src/shared/app'
import * as schedule from '../src/shared/CronExpression'
import { CRON_OUTCOME_UNKNOWN } from '../src/fork/module/Cron/types'
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
  '../../fork/module/Cron/types': { CRON_OUTCOME_UNKNOWN },
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

const unsure = controller.remove(job)
replies.shift()!.finish({ code: 1, errorCode: CRON_OUTCOME_UNKNOWN, msg: 'Task details were not saved.' })
assert.equal(await unsure, false)
assert.equal(controller.outcome(job).status, 'unknown')
assert.equal(await controller.remove(job), false)
assert.equal(replies.length, 0)
console.log('Scheduled tasks passed: portable validation, shared loading, duplicate guard, command failure, partial registration and no replay after an unknown write.')
