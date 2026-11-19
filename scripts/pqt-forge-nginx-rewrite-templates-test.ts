import assert from 'node:assert/strict'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  listNginxRewriteTemplates,
  prepareNginxRewriteTemplateDirectory,
  readNginxRewriteTemplate
} from '../src/fork/module/Host/NginxRewriteTemplates'

const workspace = await mkdtemp(join(tmpdir(), 'pqt-rewrite-templates-'))
try {
  const roots = { Static: join(workspace, 'static'), BaseDir: join(workspace, 'data') }
  const bundled = join(roots.Static, 'rewrite')
  await mkdir(bundled, { recursive: true })
  await mkdir(roots.BaseDir)
  await writeFile(join(bundled, 'laravel.conf'), 'try_files $uri $uri/ /index.php?$query_string;\n')
  await writeFile(join(bundled, 'ignored.txt'), 'not a bundled template')

  assert.deepEqual(await listNginxRewriteTemplates(roots, 'bundled'), ['laravel.conf'])
  assert.deepEqual(await listNginxRewriteTemplates(roots, 'user'), [])
  const user = await prepareNginxRewriteTemplateDirectory(roots)
  assert.equal(user, join(await realpath(roots.BaseDir), 'NginxRewriteTemplate'))
  assert.equal(await prepareNginxRewriteTemplateDirectory(roots), user)

  const text = 'rewrite ^/(.*)$ /index.php?route=$1 last;\r\n# Tiếng Việt\r\n'
  await writeFile(join(user, 'Custom rules'), text)
  await mkdir(join(user, 'nested.conf'))
  await writeFile(join(user, 'empty.conf'), '')
  await writeFile(join(user, 'large.conf'), Buffer.alloc(256 * 1024 + 1, 'a'))
  await writeFile(join(user, 'binary.conf'), Buffer.from([0xc3, 0x28]))
  const outside = join(workspace, 'outside')
  await mkdir(outside)
  await writeFile(join(outside, 'external.conf'), 'outside file')

  // Windows junctions can be tested without the permission needed for file symlinks.
  await symlink(
    outside,
    join(user, 'linked-folder.conf'),
    process.platform === 'win32' ? 'junction' : 'dir'
  )
  if (process.platform !== 'win32') {
    await symlink(join(outside, 'external.conf'), join(user, 'linked-file.conf'))
    await assert.rejects(
      readNginxRewriteTemplate(roots, 'user', 'linked-file.conf'),
      /regular file/
    )
  }
  assert.deepEqual(await listNginxRewriteTemplates(roots, 'user'), [
    'binary.conf',
    'Custom rules',
    'empty.conf',
    'large.conf'
  ])
  assert.match(await readNginxRewriteTemplate(roots, 'bundled', 'laravel.conf'), /try_files/)
  assert.equal(await readNginxRewriteTemplate(roots, 'user', 'Custom rules'), text)
  assert.equal(await readNginxRewriteTemplate(roots, 'user', 'empty.conf'), '')
  await assert.rejects(readNginxRewriteTemplate(roots, 'user', 'large.conf'), /256 KiB/)
  await assert.rejects(readNginxRewriteTemplate(roots, 'user', 'binary.conf'), /UTF-8/)
  await assert.rejects(readNginxRewriteTemplate(roots, 'user', 'nested.conf'), /regular file/)
  await assert.rejects(
    readNginxRewriteTemplate(roots, 'user', 'linked-folder.conf'),
    /regular file/
  )
  for (const name of ['..', '../outside/external.conf', '..\\external.conf', 'large.conf:stream']) {
    await assert.rejects(
      readNginxRewriteTemplate(roots, 'user', name),
      /Invalid rewrite template filename/
    )
  }

  const redirected = { BaseDir: join(workspace, 'redirected') }
  await mkdir(redirected.BaseDir)
  await symlink(
    outside,
    join(redirected.BaseDir, 'NginxRewriteTemplate'),
    process.platform === 'win32' ? 'junction' : 'dir'
  )
  await assert.rejects(prepareNginxRewriteTemplateDirectory(redirected), /must be a directory/)
  await assert.rejects(listNginxRewriteTemplates(redirected, 'user'), /must be a directory/)
  await assert.rejects(
    readNginxRewriteTemplate(redirected, 'user', 'external.conf'),
    /must be a directory/
  )

  const many = { BaseDir: join(workspace, 'many-entries') }
  await mkdir(many.BaseDir)
  const manyTemplates = await prepareNginxRewriteTemplateDirectory(many)
  for (let start = 0; start < 2049; start += 64) {
    await Promise.all(
      Array.from({ length: Math.min(64, 2049 - start) }, (_, index) =>
        writeFile(join(manyTemplates, 'template-' + (start + index)), '')
      )
    )
  }
  await assert.rejects(listNginxRewriteTemplates(many, 'user'), /more than 2,048 entries/)
  assert.equal(await readNginxRewriteTemplate(many, 'user', 'template-2048'), '')

  console.log(
    'Nginx rewrite templates passed: bundled and user roots, folder preparation, limits and scoped reads.'
  )
} finally {
  await rm(workspace, { recursive: true, force: true })
}
