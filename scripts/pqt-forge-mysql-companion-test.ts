import assert from 'node:assert/strict'
import { loadIsolated } from './helpers/load-isolated'

let groupStarts = 0
let groupStops = 0
let primaryStops = 0
let failGroupStart = false
let failGroupStop = false
let failPrimaryStop = false
let failPrimaryStart = true
const { runMysqlServiceLifecycle } = await loadIsolated(
  'src/render/components/Mysql/serviceLifecycle.ts',
  {
    './mysql': {
      MysqlStore: () => ({
        init: async () => undefined,
        groupStart: async () => {
          groupStarts++
          return failGroupStart ? 'The group could not start' : true
        },
        groupStop: async () => {
          groupStops++
          return failGroupStop ? 'The group could not stop' : true
        }
      })
    }
  },
  { window: { Server: { MysqlDir: '/fixture/mysql' } } }
)
const primary = {
  start: async () => (failPrimaryStart ? 'The primary could not start' : true),
  restart: async () => (failPrimaryStart ? 'The primary could not restart' : true),
  stop: async () => {
    primaryStops++
    if (failPrimaryStop) throw new Error('The primary could not stop')
    return true
  }
}

const failedStart = await runMysqlServiceLifecycle(primary, 'start')
assert.equal(failedStart.result, 'The primary could not start')
assert.equal(groupStarts, 0)

failPrimaryStart = false
failGroupStart = true
const partialRestart = await runMysqlServiceLifecycle(primary, 'restart')
assert.equal(partialRestart.result, true)
assert.match(partialRestart.warning, /group could not start/)
assert.equal(groupStarts, 1)

failPrimaryStop = true
failGroupStop = true
const failedStop = await runMysqlServiceLifecycle(primary, 'stop')
assert.match(failedStop.result, /primary could not stop[\s\S]*group could not stop/)
assert.equal(primaryStops, 1)
assert.equal(groupStops, 1)

failPrimaryStop = false
const partialStop = await runMysqlServiceLifecycle(primary, 'stop')
assert.equal(partialStop.result, true)
assert.match(partialStop.warning, /group could not stop/)
assert.equal(groupStops, 2)

console.log('MySQL service controls preserve primary results and attempt independent group stops.')
