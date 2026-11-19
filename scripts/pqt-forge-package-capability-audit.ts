import assert from 'node:assert/strict'
import { packageCapabilities } from '../src/render-next/packages/capabilities'
import { packageModules } from '../src/render-next/packages/catalog'
assert.equal(packageCapabilities.length, packageModules.length)
for (const capability of packageCapabilities) {
  assert.ok(capability.catalog || capability.update === 'unsupported', capability.flag)
  assert.equal(capability.installed, true)
  assert.equal(capability.current, true)
  assert.equal(capability.timeout, true)
  assert.equal(capability.failure, true)
  if (capability.catalog) assert.equal(capability.remove, true)
}
console.log('PQT Forge package capability audit passed: every registered provider has explicit catalog, installed/current, lifecycle, timeout, failure and update semantics.')
