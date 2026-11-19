import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)

async function isFile(path: string) {
  try {
    return (await stat(path)).isFile()
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error
    return false
  }
}

export async function pgvectorStatus(target: { bin: string; version: string }) {
  const major = /^\d+/.exec(target?.version)?.[0]
  if (
    !major ||
    typeof target?.bin !== 'string' ||
    !isAbsolute(target.bin) ||
    !/^pg_ctl(?:\.exe)?$/i.test(basename(target.bin))
  ) {
    throw new Error('Select an installed PostgreSQL version.')
  }
  const windows = process.platform === 'win32'
  if (!(await isFile(target.bin))) throw new Error('The selected PostgreSQL binary was not found.')
  const pgConfig = join(dirname(target.bin), windows ? 'pg_config.exe' : 'pg_config')
  if (!(await isFile(pgConfig)))
    throw new Error('The selected installation does not provide pg_config.')
  async function read(option: string) {
    const { stdout } = await exec(pgConfig, [option], { timeout: 10_000, windowsHide: true })
    return stdout.trim()
  }
  const [version, share, library] = await Promise.all([
    read('--version'),
    read('--sharedir'),
    read('--pkglibdir')
  ])
  if (
    /^PostgreSQL (\d+)/.exec(version)?.[1] !== major ||
    !isAbsolute(share) ||
    !isAbsolute(library)
  ) {
    throw new Error('pg_config did not confirm paths for the selected PostgreSQL version.')
  }
  const extension = join(share, 'extension')
  const evidence = await Promise.all([
    isFile(join(extension, 'vector.control')),
    ...(windows ? ['vector.dll'] : ['vector.so', 'vector.dylib']).map((file) =>
      isFile(join(library, file))
    )
  ])
  const installed = evidence[0] && evidence.slice(1).some(Boolean)
  const writable =
    installed ||
    windows ||
    (
      await Promise.all(
        [extension, library].map(async (path) => {
          try {
            await access(path, constants.W_OK)
            return true
          } catch (error) {
            if (['EACCES', 'EPERM', 'EROFS'].includes((error as NodeJS.ErrnoException)?.code ?? ''))
              return false
            throw error
          }
        })
      )
    ).every(Boolean)
  return { installed, pgConfig, requiresAdministrator: !writable }
}
