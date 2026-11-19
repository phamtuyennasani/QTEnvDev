import { BrewStore } from '@/store/brew'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'
import type { ServiceFile } from '../state/serviceFilesController'

type RedisTarget = { version: string; bin: string }

const preparations = new Map<string, Promise<ServiceFile[]>>()
const unknownInitializations = new Set<string>()
const unknownMessage =
  'Redis configuration setup did not report a result. Close and reopen to check whether its file is ready.'

async function request(method: 'listConfigFiles' | 'initConf', target: RedisTarget) {
  const response = await forkTerminalRequest(
    'app-fork:redis',
    [method, target],
    method === 'initConf' ? unknownMessage : 'Redis configuration lookup timed out.',
    60_000
  )
  if (response.code !== 0)
    throw new Error(response.msg || 'Redis configuration could not be loaded.')
  return response.data
}

async function prepare(target: RedisTarget): Promise<ServiceFile[]> {
  const files = await request('listConfigFiles', target)
  const file = Array.isArray(files)
    ? files.find((item) => item?.name === 'main' && typeof item.path === 'string')
    : undefined
  if (!file || typeof file.exists !== 'boolean') {
    throw new Error('Redis did not report a configuration file for the selected version.')
  }

  if (file.exists === true) {
    unknownInitializations.delete(file.path)
  } else {
    if (unknownInitializations.has(file.path)) throw new Error(unknownMessage)
    try {
      if ((await request('initConf', target)) !== file.path) {
        throw new Error('Redis configuration setup returned a different file.')
      }
    } catch (error) {
      if (error instanceof Error && error.message === unknownMessage)
        unknownInitializations.add(file.path)
      throw error
    }
  }
  return [{ name: file.name, path: file.path, exists: true, kind: 'config' }]
}

export async function redisConfigurationFiles(version: string) {
  const brew = BrewStore()
  const installed = brew.module('redis').installed
  const configured = brew.currentVersion('redis')
  const item =
    installed.find((entry) => entry.run && entry.version === version) ??
    (configured?.version === version ? configured : undefined) ??
    installed.find((entry) => entry.version === version)
  if (!item?.bin || !item.version) throw new Error('Select an installed Redis version first.')

  const target = { version: item.version, bin: item.bin }
  const key = target.version.split('.')[0]
  const pending = preparations.get(key)
  if (pending) return pending
  const operation = prepare(target)
  preparations.set(key, operation)
  try {
    return await operation
  } finally {
    preparations.delete(key)
  }
}
