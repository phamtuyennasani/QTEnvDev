import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const source = await (await import('node:fs/promises')).readFile(path.join(root, 'build/pqt-forge.svg'))
const staticDir = path.join(root, 'dist/electron/static')
const buildDir = path.join(root, 'build/pqt-forge-icons')
await mkdir(staticDir, { recursive: true })
await mkdir(buildDir, { recursive: true })

const png = async (size: number, output: string) => {
  await sharp(source).resize(size, size).png().toFile(output)
}
await png(512, path.join(staticDir, 'pqt-forge-512.png'))
await png(32, path.join(staticDir, 'pqt-forge-tray.png'))
for (const size of [16, 32, 48, 64, 128, 256, 512]) {
  await png(size, path.join(buildDir, `${size}x${size}.png`))
}

const sizes = [16, 24, 32, 48, 64, 128, 256]
const images = await Promise.all(sizes.map(async (size) => ({ size, data: await sharp(source).resize(size, size).png().toBuffer() })))
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4)
const entries = Buffer.alloc(images.length * 16)
let offset = header.length + entries.length
for (const [index, image] of images.entries()) {
  const entry = index * 16
  entries.writeUInt8(image.size === 256 ? 0 : image.size, entry)
  entries.writeUInt8(image.size === 256 ? 0 : image.size, entry + 1)
  entries.writeUInt16LE(1, entry + 4); entries.writeUInt16LE(32, entry + 6)
  entries.writeUInt32LE(image.data.length, entry + 8); entries.writeUInt32LE(offset, entry + 12)
  offset += image.data.length
}
await writeFile(path.join(buildDir, 'pqt-forge.ico'), Buffer.concat([header, entries, ...images.map((image) => image.data)]))
console.log('PQT Forge icon assets generated')
