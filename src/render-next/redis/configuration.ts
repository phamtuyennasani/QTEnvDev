import { BrewStore } from '@/store/brew'
import type { SoftInstalled } from '@shared/app'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'
import type { ServiceFile } from '../state/serviceFilesController'

type RedisTarget = { version: string; bin: string }

const preparations = new Map<string, Promise<void>>()
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
    await initialize(file.path, target)
  }
  return [{
    name: file.name,
    path: file.path,
    exists: true,
    kind: 'config',
    defaultPath: typeof file.defaultPath === 'string' ? file.defaultPath : undefined
  }]
}

function initialize(path: string, target: RedisTarget) {
  const pending = preparations.get(path)
  if (pending) return pending
  const operation = request('initConf', target).then((result) => {
    if (result !== path) throw new Error('Redis configuration setup returned a different file.')
  }).catch((error) => {
    if (error instanceof Error && error.message === unknownMessage) unknownInitializations.add(path)
    throw error
  }).finally(() => preparations.delete(path))
  preparations.set(path, operation)
  return operation
}

export async function redisConfigurationFiles(version?: SoftInstalled) {
  if (!version?.bin || !version.version) throw new Error('Select an installed Redis version first.')
  const target = { version: version.version, bin: version.bin }
  if (!BrewStore().module('redis').installed.some((item) => item.bin === target.bin && item.version === target.version)) {
    throw new Error('The selected Redis installation changed.')
  }
  return prepare(target)
}
