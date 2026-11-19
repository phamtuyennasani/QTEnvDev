import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { phpMyAdminProfile } from '../src/fork/module/Host/PhpMyAdminProfile'

const mysql = { engine: 'mysql' as const, version: '8.4.1', port: 4406 }
const mariadb = { engine: 'mariadb' as const, version: '11.4.2', port: 4407 }
const existing = `<?php
$cfg['VersionCheck'] = false;
?>`
const first = phpMyAdminProfile(existing, mysql)
const second = phpMyAdminProfile(first.content, mariadb)
assert.equal(phpMyAdminProfile(second.content, mariadb).content, second.content)
assert(second.content.includes("$cfg['VersionCheck'] = false;"))
assert(second.content.includes("'port' => '4406'"))
assert(second.content.includes("'port' => '4407'"))
assert.equal(second.content.match(/'host' => '127.0.0.1'/g)?.length, 2)
assert.equal(second.content.match(/'auth_type' => 'cookie'/g)?.length, 2)
assert(!second.content.includes('password'))
assert.equal(first.server, 69942)
assert.equal(second.server, 69943)
for (const port of [0, -1, 65536, 4406.5, NaN]) {
  assert.throws(() => phpMyAdminProfile(existing, { ...mysql, port }))
}
assert.throws(() => phpMyAdminProfile('not PHP', mysql))
assert.throws(() => phpMyAdminProfile('<?php ?> custom ?>', mysql))
assert.throws(() => phpMyAdminProfile('<?php // QTEnvDev managed database profile 69942', mysql))
if (process.argv.includes('--verify-php')) {
  const php = spawnSync('php', [], { input: second.content + 'echo json_encode($cfg);', encoding: 'utf8' })
  assert.equal(php.status, 0, php.error?.message || php.stderr)
  const config = JSON.parse(php.stdout)
  assert.equal(config.VersionCheck, false)
  assert.equal(config.Servers[first.server].port, '4406')
  assert.equal(config.Servers[second.server].port, '4407')
}
console.log('phpMyAdmin profiles passed: separate engine ports, cookie authentication, no credentials, preserved custom settings and idempotent updates.')
