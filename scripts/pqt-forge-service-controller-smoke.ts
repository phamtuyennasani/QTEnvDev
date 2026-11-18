import { readFileSync } from 'node:fs'

const source = readFileSync('src/render-next/state/serviceController.ts', 'utf8')
const required = [
  "if (service.state === 'busy') return",
  'operationSequence',
  'activeOperations.set(service, operationId)',
  'activeOperations.get(service) !== operationId',
  'activeOperations.delete(service)',
  "if (service.state === 'busy') return"
]
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Missing service lifecycle guard: ${marker}`)
}
console.log('PQT Forge service controller smoke check passed (duplicate guard and stale-operation cleanup present).')
