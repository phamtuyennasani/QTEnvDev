import { existsSync, statSync } from 'node:fs'

const files = ['build/pqt-forge.svg', 'build/pqt-forge-icons/pqt-forge.ico', 'build/pqt-forge-icons/16x16.png', 'build/pqt-forge-icons/256x256.png', 'dist/electron/static/pqt-forge-512.png', 'dist/electron/static/pqt-forge-tray.png']
for (const file of files) {
  if (!existsSync(file) || statSync(file).size === 0) throw new Error(`Missing PQT Forge icon asset: ${file}`)
}
console.log('PQT Forge icon smoke check passed (window, tray, Windows, and Linux assets).')
