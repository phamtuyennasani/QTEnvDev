import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import jwt from '../src/render/components/Tools/JWT/store'
import { matchRegex } from '../src/render/components/Tools/RegexTester/regex-tester.service'
import { JSONSort } from '../src/render/util/JsonSort'
import { codesByCategories } from '../src/render/components/Tools/HTTPStatusCodes/http-status-codes.constants'

const header = { alg: 'ignored', typ: 'JWT', kid: 'local' }
const payload = { sub: '123', name: 'Tiếng Việt', roles: ['reader'] }
const base64url = (value: string) => Buffer.from(value).toString('base64url')
for (const algorithm of ['HS256', 'HS384', 'HS512'] as const) {
  jwt.algorithm = algorithm
  jwt.secret = 'parity-test-secret'
  jwt.header = JSON.stringify(header)
  jwt.payload = JSON.stringify(payload)
  jwt.createToken()
  assert.equal(jwt.encodeError, '')
  const parts = jwt.token.split('.')
  assert.deepEqual(JSON.parse(Buffer.from(parts[0], 'base64url').toString()), { ...header, alg: algorithm })
  assert.deepEqual(JSON.parse(Buffer.from(parts[1], 'base64url').toString()), payload)
  assert.equal(parts[2], createHmac('sha' + algorithm.slice(2), jwt.secret).update(parts[0] + '.' + parts[1]).digest('base64url'))
  jwt.useCreatedToken()
  assert.equal(jwt.signatureValid, true)
  assert.deepEqual(JSON.parse(jwt.decodedPayload), payload)
  jwt.decodeSecret = 'wrong'
  jwt.decode()
  assert.equal(jwt.signatureValid, false)
  jwt.decodeSecret = jwt.secret
  jwt.decodedToken = parts[0] + '.' + base64url(JSON.stringify({ ...payload, sub: 'tampered' })) + '.' + parts[2]
  jwt.decode()
  assert.equal(jwt.signatureValid, false)
}
jwt.algorithm = 'none'
jwt.createToken()
jwt.useCreatedToken()
assert.equal(jwt.token.endsWith('.'), true)
assert.equal(jwt.signatureValid, false)
jwt.header = '[]'
jwt.createToken()
assert.match(jwt.encodeError, /JSON object/)
assert.equal(jwt.token, '')
jwt.decodedToken = 'broken'
jwt.decode()
assert.equal(jwt.signatureValid, false)
assert.match(jwt.decodeError, /header, payload and signature/)

const matches = matchRegex('(?<word>[a-z]+)-(\\d+)', 'alpha-12 beta-3', 'dgu')
assert.equal(matches.length, 2)
assert.deepEqual(matches[0].groups, [{ name: 'word', value: 'alpha', start: 0, end: 5 }])
assert.deepEqual(matches[1].captures[1], { name: '2', value: '3', start: 14, end: 15 })
assert.equal(matchRegex('a.b', 'a\nb', 'dgsu').length, 1)
assert.equal(matchRegex('^B', 'a\nB', 'dgmu').length, 1)
assert.equal(matchRegex('missing', 'nothing', 'dg').length, 0)
assert.throws(() => matchRegex('[', 'text', 'dg'))
assert.equal(matchRegex('(a)?b', 'b ab', 'dg').length, 2)
assert.deepEqual(matchRegex('(?<optional>a)?b', 'b', 'dg')[0].groups, [])
assert.deepEqual(matchRegex('(?=a)', 'aa', 'dg').map(match => match.index), [0, 1])
assert.equal(matchRegex('a', 'aaa', 'd').length, 1)
const object = { z: { y: 2, a: 1 }, a: [{ z: 2, a: 1 }] }
assert.equal(JSON.stringify(JSONSort(structuredClone(object))), '{"a":[{"a":1,"z":2}],"z":{"a":1,"y":2}}')
assert.equal(JSON.stringify(JSONSort(structuredClone(object), 'desc')), '{"z":{"y":2,"a":1},"a":[{"z":2,"a":1}]}')
const codes = codesByCategories.flatMap(category => category.codes)
assert(codes.length > 50)
assert(codes.some(code => code.code === 103))
assert(codes.some(code => code.code === 207 && code.type === 'WebDav'))
assert(codes.some(code => code.code === 418))
console.log('PQT Forge tool parity passed: legacy JWT HMAC/none/tamper, regex captures/ranges/flags, nested JSON sorting and complete HTTP reference.')
