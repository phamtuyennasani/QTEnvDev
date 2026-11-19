import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from '@vue/compiler-sfc'
const read = (path: string) => readFileSync(path, 'utf8')
const screen = read('src/render-next/screens/ToolsScreen.vue')
assert.deepEqual(parse(screen).errors, [])
for (const name of ['CapturerPanel', 'SiteSuckerPanel', 'LegacyToolPanel', 'CustomToolPanel', 'ImageCompressPanel']) assert.ok(screen.includes(name), name)
for (const [filename, klass] of [['capturerController.ts', 'CapturerOperation'], ['siteSuckerController.ts', 'SiteSuckerModel'], ['toolLibraryController.ts', 'ToolLibraryController']]) {
  const source = read('src/render-next/state/' + filename)
  assert.ok(source.includes('reactiveBind(new ' + klass), filename)
  assert.ok(source.includes('StorageGetAsync') && source.includes('StorageSetAsync'), filename + ' persistence')
}
for (const name of ['BasicConfig', 'CompressConfig', 'EffectsConfig', 'WatermarkConfig', 'TextureConfig']) assert.ok(read('src/render-next/components/ImagePipelineOptions.vue').includes(name), name)
for (const filename of ['CapturerPanel.vue', 'SiteSuckerPanel.vue', 'ImageCompressPanel.vue']) assert.doesNotMatch(read('src/render-next/components/' + filename), /IPC\.send/)
console.log('Phase 3 source wiring passed. Behavioral lifecycle and parity tests run separately; this check does not prove runtime acceptance.')
