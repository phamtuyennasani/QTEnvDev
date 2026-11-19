import { constants } from 'node:fs'
import { open, stat } from 'node:fs/promises'

export async function readLogTail(path: string): Promise<string> {
  // Do not block opening a pipe or accept one swapped in after the initial check.
  if (!(await stat(path)).isFile()) throw new Error('The log path is not a regular file.')
  const file = await open(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0))
  try {
    const info = await file.stat()
    if (!info.isFile()) throw new Error('The log path is not a regular file.')
    const size = Math.min(200_000, info.size)
    const { buffer, bytesRead } = await file.read(Buffer.alloc(size), 0, size, info.size - size)
    return buffer.toString('utf8', 0, bytesRead)
  } finally {
    await file.close()
  }
}

export async function clearExistingLog(path: string): Promise<void> {
  if (!(await stat(path)).isFile()) throw new Error('The log path is not a regular file.')
  const file = await open(path, constants.O_WRONLY | (constants.O_NONBLOCK ?? 0))
  try {
    if (!(await file.stat()).isFile()) throw new Error('The log path is not a regular file.')
    await file.truncate(0)
  } finally {
    await file.close()
  }
}
