import { existsSync, readFileSync, statSync } from 'node:fs'

const assets = [
  'dist/render/next.html',
  'dist/electron/static/pqt-forge.svg',
  'dist/electron/static/pqt-forge-512.png',
  'dist/electron/static/pqt-forge-tray.png',
  'build/pqt-forge-icons/pqt-forge.ico',
  'build/pqt-forge-icons/16x16.png',
  'build/pqt-forge-icons/256x256.png'
]
for (const file of assets) {
  if (!existsSync(file) || statSync(file).size === 0) throw new Error(`Missing packaging asset: ${file}`)
}
const win = readFileSync('configs/electron-builder.win.ts', 'utf8')
const linux = readFileSync('configs/electron-builder.linux.ts', 'utf8')
const page = readFileSync('src/main/configs/page.ts', 'utf8')
if (!win.includes('build/pqt-forge-icons/pqt-forge.ico')) throw new Error('Windows builder does not use PQT Forge ICO')
if (!linux.includes('build/pqt-forge-icons')) throw new Error('Linux builder does not use PQT Forge icons')
if (!page.includes("process.env.PQT_FORGE_NEXT_RENDERER !== '0'")) throw new Error('PQT Forge is not the default renderer')
console.log('PQT Forge packaging smoke check passed (renderer, window, tray, Windows, and Linux assets).')
