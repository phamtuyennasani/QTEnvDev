import assert from 'node:assert/strict'
import {
  getWebServerSettings,
  updateWebServerSetting
} from '../src/render-next/serviceConfiguration/webServerDirectives'

const apache = ['# Timeout 60', '<VirtualHost *:80>', '  Timeout 5', '</VirtualHost>', ''].join('\r\n')
const apacheDraft = updateWebServerSetting(apache, 'apache', 'Timeout', true, '120')
assert.equal(apacheDraft, apache.replace('# Timeout 60', 'Timeout 120'))
assert.equal(
  updateWebServerSetting(apacheDraft, 'apache', 'Timeout', false, '120'),
  apache.replace('# Timeout 60', '# Timeout 120')
)
const nginx = [
  'events {}',
  'http { # primary HTTP context',
  '  server {',
  '    gzip on;',
  '    set $item "{ escaped }";',
  '  }',
  '  gzip off; # global default',
  '}',
  ''
].join('\n')
assert.equal(getWebServerSettings(nginx, 'nginx')?.find((field) => field.name === 'gzip')?.value, 'off')
assert.equal(updateWebServerSetting(nginx, 'nginx', 'gzip', true, 'on'), nginx.replace('gzip off;', 'gzip on;'))
assert.match(updateWebServerSetting(nginx, 'nginx', 'client_max_body_size', true, '5m'), /primary HTTP context\n    client_max_body_size 5m;/)
assert.equal(updateWebServerSetting(nginx, 'nginx', 'gzip', true, 'on; include /etc/path'), nginx)
const duplicate = nginx.replace('gzip off;', 'gzip on;\n  gzip off;')
assert.equal(updateWebServerSetting(duplicate, 'nginx', 'gzip', false, 'off'), duplicate)
assert.equal(getWebServerSettings('http { gzip off; }', 'nginx'), undefined)
console.log('Forge web server settings preserve global scope, nested directives, comments and line endings.')
