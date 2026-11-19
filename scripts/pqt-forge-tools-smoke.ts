import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = (file: string) => readFileSync('src/render-next/' + file, 'utf8')
assert.match(source('screens/ToolsScreen.vue'), /LocalToolPanel/)
assert.match(source('tools/LocalToolPanel.vue'), /await transform/)
assert.match(source('tools/transforms.ts'), /subtle\.digest/)
assert.match(source('tools/transforms.ts'), /signature and claims have NOT been verified/)
assert.doesNotMatch(source('state/toolController.ts'), /shell\.openExternal|is ready to open/)
assert.match(source('components/ImageCompressPanel.vue'), /ImagePipelineOptions/)
for (const component of ['BasicConfig', 'CompressConfig', 'EffectsConfig', 'WatermarkConfig', 'TextureConfig']) assert.match(source('components/ImagePipelineOptions.vue'), new RegExp(component))
assert.match(source('../render/components/Tools/ImageCompress/ImageBatchOperation.ts'), /doCompressTask/)
console.log('PQT Forge tools smoke passed (native local utility panels, pending network tools labeled).')
