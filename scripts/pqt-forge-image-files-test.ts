import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import { ImageCompressTask } from '../src/fork/module/Image/ImageCompressTask'
import { ImageInfoFetchTask } from '../src/fork/module/Image/ImageInfoFetchTask'

const directory = await mkdtemp(join(tmpdir(), 'qtenvdev-image-'))
try {
  const original = join(directory, 'source.png')
  const backup = join(directory, 'backup', 'source.png')
  await sharp({ create: { width: 30, height: 20, channels: 3, background: '#8899aa' } }).png().toFile(original)
  const before = await readFile(original)
  const info = new ImageInfoFetchTask(original)
  assert.equal(await info.run(), true)
  const noBackup = new ImageCompressTask(info, { format: 'none', width: 10 }, original, '')
  assert.equal(await noBackup.run(), false, 'same-source writes require a backup')
  assert.deepEqual(await readFile(original), before)
  const task = new ImageCompressTask(info, { format: 'none', width: 10, withMetadata: false, timeoutSeconds: 30 }, original, backup)
  assert.equal(await task.run(), true, task.errorMessage)
  assert.equal((await sharp(original).metadata()).width, 10)
  assert.deepEqual(await readFile(backup), before, 'overwrite preserves original bytes in a separate backup')
  const protectedBackup = new ImageCompressTask(info, { format: 'none', width: 5 }, original, backup)
  assert.equal(await protectedBackup.run(), false, 'an existing backup is never overwritten')
  assert.deepEqual(await readFile(backup), before)
  assert.equal((await sharp(original).metadata()).width, 10, 'backup failure leaves the source untouched')
  console.log('PQT Forge image filesystem passed: real Sharp same-path overwrite, original backup and failed-backup isolation.')
} finally { await rm(directory, { recursive: true, force: true }) }
