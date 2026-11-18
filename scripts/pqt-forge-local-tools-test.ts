import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { encodeBase64, decodeBase64, inspectJwt, lineDiff, transform } from '../src/render-next/tools/transforms'

const unicode = 'Tiếng Việt · PQT Forge 🛠️'
assert.equal(decodeBase64(encodeBase64(unicode)), unicode)
assert.throws(() => decodeBase64('%%%'))
assert.throws(() => decodeBase64('/w=='))
const segment = (value: unknown) => encodeBase64(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const token = segment({ alg: 'none' }) + '.' + segment({ sub: 'local-test', display: unicode }) + '.'
assert.equal(inspectJwt(token).payload.display, unicode)
assert.match(inspectJwt(token).warning, /NOT been verified/)
assert.throws(() => inspectJwt('invalid'))
assert.equal(await transform('json', '{"answer":42}', { mode: 'minify' }), '{"answer":42}')
await assert.rejects(transform('json', '{broken}'))
assert.equal(await transform('hash', 'abc', { subtle: webcrypto.subtle as SubtleCrypto }), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
assert.equal(lineDiff('same', 'same'), 'The texts are identical.')
assert.equal(lineDiff('a\nold\nz', 'a\nnew\nz'), '  a\n- old\n+ new\n  z')
assert.equal(await transform('url', 'hello + Việt'), 'hello%20%2B%20Vi%E1%BB%87t')
assert.equal(await transform('url', 'hello%20%2B%20Vi%E1%BB%87t', { mode: 'decode' }), 'hello + Việt')
assert.equal(await transform('html', '<script>"&\'</script>'), '&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;')
assert.equal(await transform('html', '&lt;strong&gt;&amp;&lt;/strong&gt;', { mode: 'decode' }), '<strong>&</strong>')
assert.equal(JSON.parse(await transform('timestamp', '0')).iso, '1970-01-01T00:00:00.000Z')
assert.equal(JSON.parse(await transform('timestamp', '1000', { mode: 'milliseconds' })).unixSeconds, 1)
await assert.rejects(transform('timestamp', '2026-11-18T12:00:00'))
await assert.rejects(transform('json', ' '.repeat(200001)))
console.log('PQT Forge local utilities passed: Unicode Base64, JWT decode warning, JSON errors, SHA-256 known vector, line diff, URL, HTML and timestamp units.')
