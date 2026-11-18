import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const output = path.resolve(process.cwd(), 'dist/render/next.html')
if (!existsSync(output)) {
  throw new Error(`Built next renderer entry is missing: ${output}. Run the production renderer build first.`)
}
if (!readFileSync(output, 'utf8').includes('./static/')) {
  throw new Error('Built PQT Forge renderer has no static asset references')
}
console.log(`PQT Forge built renderer smoke check passed: ${output}`)
