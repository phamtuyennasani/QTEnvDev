import { build } from 'vite'
import viteConfig from '../configs/vite.config'
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

await build(viteConfig.nextBuildConfig)
await import('./generate-pqt-forge-icons')
await mkdir(path.resolve('dist/electron/static'), { recursive: true })
await copyFile(path.resolve('build/pqt-forge.svg'), path.resolve('dist/electron/static/pqt-forge.svg'))
console.log('PQT Forge renderer build completed')
