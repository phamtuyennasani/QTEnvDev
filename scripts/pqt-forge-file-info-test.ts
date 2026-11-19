import assert from 'node:assert/strict'
import { FileInfoModel, fileHashAlgorithms, type FileMetadata } from '../src/render/components/Tools/FileInfo/FileInfoModel'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((success, failure) => { resolve = success; reject = failure })
  return { promise, resolve, reject }
}
const reads = new Map<string, ReturnType<typeof deferred<any>>>()
const read = (key: string) => { const value = deferred<any>(); reads.set(key, value); return value.promise }
const model = new FileInfoModel({ stat: (path) => read(path + ':metadata'), hash: (path, algorithm) => read(path + ':' + algorithm) })
const stats: FileMetadata = { size: 100, atimeMs: 1000, mtimeMs: 2000, ctimeMs: 3000, birthtimeMs: 4000 }
const first = model.inspect('first.bin')
assert.equal(model.inspect('first.bin'), first, 'same in-flight selection cannot duplicate reads')
const second = model.inspect('second.bin')
await Promise.resolve()
assert.equal(reads.size, 12)
for (const field of ['metadata', ...fileHashAlgorithms]) reads.get('second.bin:' + field)!.resolve(field === 'metadata' ? stats : 'second-' + field)
assert.equal(await second, true)
for (const field of ['metadata', ...fileHashAlgorithms]) reads.get('first.bin:' + field)!.resolve(field === 'metadata' ? { ...stats, size: 999 } : 'stale-' + field)
assert.equal(await first, false)
assert.equal(model.path, 'second.bin')
assert.equal(model.metadata!.size, 100)
assert.equal(model.hashes.md5, 'second-md5', 'late old hash cannot overwrite current selection')

const partial = model.inspect('partial.bin')
await Promise.resolve()
reads.get('partial.bin:metadata')!.reject(new Error('File metadata denied'))
for (const algorithm of fileHashAlgorithms) {
  const result = reads.get('partial.bin:' + algorithm)!
  if (algorithm === 'sha1') result.reject(new Error('SHA1 read denied'))
  else result.resolve(algorithm === 'sha256' ? '' : 'partial-' + algorithm)
}
assert.equal(await partial, false)
assert.equal(model.metadata, undefined, 'failed metadata never displays the previous file metadata')
assert.equal(model.hashes.md5, 'partial-md5', 'failed siblings cannot erase successful hash')
assert.equal(model.hashes.sha512, 'partial-sha512')
assert.match(model.errors.metadata!, /metadata denied/)
assert.match(model.errors.sha1!, /SHA1 read denied/)
assert.match(model.errors.sha256!, /could not be read/)
assert.equal(model.running, false)

const missing = new FileInfoModel({ stat: async () => null, hash: async () => '' })
assert.equal(await missing.inspect('missing.bin'), false)
assert.match(missing.errors.metadata!, /could not be read/, 'a null host response is a required metadata failure')
assert.equal(Object.keys(missing.errors).length, 6)

const late = new FileInfoModel({ stat: async () => stats, hash: (path, algorithm) => read(path + ':' + algorithm) }, 1)
const pending = late.inspect('slow.bin')
await new Promise((resolve) => setTimeout(resolve, 5))
assert.equal(late.unknown, true)
assert.equal(late.inspect('slow.bin'), pending, 'observation expiry cannot authorize a duplicate')
for (const algorithm of fileHashAlgorithms) reads.get('slow.bin:' + algorithm)!.resolve('late-' + algorithm)
assert.equal(await pending, true)
assert.equal(late.unknown, false)
assert.equal(late.running, false)
console.log('PQT Forge file info passed: immutable path reads, rapid reselection, independent hash failures, retained successful siblings, duplicate guard and late terminal observation.')
