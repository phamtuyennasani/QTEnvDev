import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const execFileAsync = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const staticDir = join(root, 'static')
const buildDir = join(root, 'build')
const source = await readFile(join(staticDir, 'qtenvdev-icon.svg'))
const tray = await readFile(join(staticDir, 'qtenvdev-tray.svg'))
const trayActive = await readFile(join(staticDir, 'qtenvdev-tray-active.svg'))

async function png(svg, size, output) {
  await mkdir(dirname(output), { recursive: true })
  await sharp(svg).resize(size, size).png().toFile(output)
}

const master = join(staticDir, '512x512.png')
await png(source, 1024, master)
await png(source, 256, join(root, 'src/render/assets/256x256.png'))
await png(tray, 32, join(staticDir, '32x32.png'))
await png(trayActive, 32, join(staticDir, '32x32_active.png'))
await png(tray, 32, join(staticDir, '32x32@1x.png'))
await png(tray, 64, join(staticDir, '32x32@2x.png'))
await png(trayActive, 32, join(staticDir, '32x32_active@1x.png'))
await png(trayActive, 64, join(staticDir, '32x32_active@2x.png'))

for (const size of [16, 32, 128, 256, 512]) {
  await png(source, size, join(buildDir, 'icons', `${size}x${size}.png`))
}
await png(source, 32, join(buildDir, 'icons', '16x16@2x.png'))
await png(source, 64, join(buildDir, 'icons', '32x32@2x.png'))
await png(source, 256, join(buildDir, 'icons', '128x128@2x.png'))
await png(source, 512, join(buildDir, 'icons', '256x256@2x.png'))

async function createIco(output) {
  const sizes = [16, 24, 32, 48, 64, 128, 256]
  const images = await Promise.all(
    sizes.map(async (size) => ({ size, data: await sharp(source).resize(size, size).png().toBuffer() }))
  )
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  const entries = Buffer.alloc(images.length * 16)
  let offset = header.length + entries.length
  for (const [index, image] of images.entries()) {
    const entry = index * 16
    entries.writeUInt8(image.size === 256 ? 0 : image.size, entry)
    entries.writeUInt8(image.size === 256 ? 0 : image.size, entry + 1)
    entries.writeUInt8(0, entry + 2)
    entries.writeUInt8(0, entry + 3)
    entries.writeUInt16LE(1, entry + 4)
    entries.writeUInt16LE(32, entry + 6)
    entries.writeUInt32LE(image.data.length, entry + 8)
    entries.writeUInt32LE(offset, entry + 12)
    offset += image.data.length
  }
  await writeFile(output, Buffer.concat([header, entries, ...images.map((image) => image.data)]))
}

await createIco(join(buildDir, 'icon.ico'))

const iconset = join(root, '.tmp-qtenvdev.iconset')
await rm(iconset, { recursive: true, force: true })
await mkdir(iconset)
try {
  const iconSizes = [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024]
  ]
  for (const [name, size] of iconSizes) await png(source, size, join(iconset, name))
  await execFileAsync('/usr/bin/iconutil', ['-c', 'icns', iconset, '-o', join(buildDir, 'Icon.icns')])
  await execFileAsync('/usr/bin/iconutil', ['-c', 'icns', iconset, '-o', join(buildDir, 'Icon@256x256.icns')])
} finally {
  await rm(iconset, { recursive: true, force: true })
}

console.log('Generated QTEnvDev app, tray, Windows, Linux, and macOS icons.')
