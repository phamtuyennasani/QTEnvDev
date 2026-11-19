import { constants, type BigIntStats } from 'node:fs'
import { lstat, mkdir, open, opendir, realpath } from 'node:fs/promises'
import { join, posix, win32 } from 'node:path'
import { TextDecoder } from 'node:util'

export type NginxRewriteTemplateSource = 'bundled' | 'user'
type TemplateRoots = { Static?: string; BaseDir?: string }

const MAX_TEMPLATE_BYTES = 256 * 1024
const MAX_DIRECTORY_ENTRIES = 2048

function missing(error: unknown) {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT'
}

function sameFile(first: BigIntStats, second: BigIntStats) {
  return first.dev === second.dev && first.ino === second.ino
}

function validName(name: unknown, source: NginxRewriteTemplateSource): name is string {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name !== '.' &&
    name !== '..' &&
    !name.includes(':') &&
    !name.includes('\0') &&
    !/[. ]$/.test(name) &&
    name === posix.basename(name) &&
    name === win32.basename(name) &&
    (source === 'user' || /\.conf$/i.test(name))
  )
}

async function templateDirectory(
  roots: TemplateRoots,
  source: NginxRewriteTemplateSource,
  create = false
) {
  if (source !== 'user' && source !== 'bundled') throw new Error('Unknown rewrite template source.')
  const root = source === 'bundled' ? roots.Static : roots.BaseDir
  if (!root) throw new Error('The rewrite template directory is unavailable.')
  const path = join(await realpath(root), source === 'bundled' ? 'rewrite' : 'NginxRewriteTemplate')
  if (create) {
    try {
      await mkdir(path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') throw error
    }
  }
  try {
    const info = await lstat(path, { bigint: true })
    if (!info.isDirectory()) throw new Error('The rewrite template location must be a directory.')
    return { path, info }
  } catch (error) {
    if (!create && source === 'user' && missing(error)) return undefined
    throw error
  }
}

async function verifyDirectory(directory: { path: string; info: BigIntStats }) {
  const info = await lstat(directory.path, { bigint: true })
  if (!info.isDirectory() || !sameFile(directory.info, info)) {
    throw new Error('The rewrite template directory changed. Try again.')
  }
}

export async function listNginxRewriteTemplates(
  roots: TemplateRoots,
  source: NginxRewriteTemplateSource
) {
  const directory = await templateDirectory(roots, source)
  if (!directory) return []
  const entries = await opendir(directory.path)
  const names: string[] = []
  let count = 0
  for await (const entry of entries) {
    if (++count > MAX_DIRECTORY_ENTRIES) {
      throw new Error('The rewrite template directory contains more than 2,048 entries.')
    }
    if (entry.isFile() && validName(entry.name, source)) names.push(entry.name)
  }
  await verifyDirectory(directory)
  return names.sort((first, second) => first.localeCompare(second))
}

export async function readNginxRewriteTemplate(
  roots: TemplateRoots,
  source: NginxRewriteTemplateSource,
  name: string
) {
  if (!validName(name, source)) throw new Error('Invalid rewrite template filename.')
  const directory = await templateDirectory(roots, source)
  if (!directory) throw new Error('The rewrite template directory does not exist.')
  const path = join(directory.path, name)
  const info = await lstat(path, { bigint: true })
  if (!info.isFile()) throw new Error('The rewrite template must be a regular file.')
  const flags = constants.O_RDONLY | (constants.O_NONBLOCK ?? 0) | (constants.O_NOFOLLOW ?? 0)
  const file = await open(path, flags)
  try {
    const opened = await file.stat({ bigint: true })
    if (!opened.isFile() || !sameFile(info, opened)) {
      throw new Error('The rewrite template changed. Choose it again.')
    }
    await verifyDirectory(directory)
    const current = await lstat(path, { bigint: true })
    if (!current.isFile() || !sameFile(opened, current)) {
      throw new Error('The rewrite template changed. Choose it again.')
    }
    if (opened.size > BigInt(MAX_TEMPLATE_BYTES))
      throw new Error('Rewrite templates are limited to 256 KiB.')

    // The file can grow after stat, so read at most one byte beyond the limit.
    const buffer = Buffer.alloc(MAX_TEMPLATE_BYTES + 1)
    let length = 0
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, length)
      if (!bytesRead) break
      length += bytesRead
    }
    if (length > MAX_TEMPLATE_BYTES) throw new Error('Rewrite templates are limited to 256 KiB.')
    const bytes = buffer.subarray(0, length)
    try {
      if (bytes.includes(0)) throw new Error('Unexpected null byte.')
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
    } catch {
      throw new Error('The rewrite template must be UTF-8 text.')
    }
  } finally {
    await file.close()
  }
}

export async function prepareNginxRewriteTemplateDirectory(roots: TemplateRoots) {
  const directory = await templateDirectory(roots, 'user', true)
  if (!directory) throw new Error('The rewrite template directory could not be prepared.')
  return directory.path
}
