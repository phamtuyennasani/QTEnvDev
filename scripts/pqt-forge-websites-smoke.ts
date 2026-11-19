import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = (file: string) => readFileSync('src/render-next/' + file, 'utf8')
assert.match(source('state/projectController.ts'), /reactiveBind\(new WebsiteController/)
assert.match(source('websites/WebsiteController.ts'), /this\.deps\.write/)
assert.match(source('websites/WebsiteController.ts'), /WebsiteOutcomeUnknown/)
assert.match(source('adapters/projectAdapter.ts'), /shell\.openExternal/)
assert.match(source('adapters/projectAdapter.ts'), /request\(\s*'handleHost'/)
assert.match(source('screens/WebsitesScreen.vue'), /@click="openProject"/)
assert.doesNotMatch(source('screens/WebsitesScreen.vue'), /IPC\.send|handleHost\(/)
assert.match(source('websites/WebsiteEditor.vue'), /projectController\.save/)
console.log('PQT Forge websites smoke passed (persistent hosts, independent editor and controller ownership).')
