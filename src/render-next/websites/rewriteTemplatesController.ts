import { reactive } from 'vue'
import { forkTerminalRequest } from '@/util/ForkTerminalRequest'
import { shell } from '@/util/NodeFn'
import { showNotice } from '../state/app'
import { websiteError } from './types'

export type RewriteTemplateSource = 'bundled' | 'user'
export type RewriteTemplate = { source: RewriteTemplateSource; filename: string }

export const rewriteTemplateSources: RewriteTemplateSource[] = ['bundled', 'user']
const catalog = reactive<
  Record<RewriteTemplateSource, { files: string[]; loading: boolean; error: string }>
>({
  bundled: { files: [], loading: false, error: '' },
  user: { files: [], loading: false, error: '' }
})
const folder = reactive({ opening: false })
const reads = new Map<string, Promise<string>>()

async function request(method: string, ...args: string[]): Promise<unknown> {
  if (!window.QTEnvDevNodeAPI) throw new Error('The desktop connection is unavailable.')
  const response = await forkTerminalRequest(
    'app-fork:host',
    [method, ...args],
    'The Nginx rewrite template request timed out.',
    15_000,
    undefined,
    true
  )
  if (response.code !== 0)
    throw new Error(response.msg || 'The Nginx rewrite template request failed.')
  return response.data
}

async function discover(source: RewriteTemplateSource) {
  const state = catalog[source]
  if (state.loading) return
  state.loading = true
  state.error = ''
  try {
    const files = await request('listNginxRewriteTemplates', source)
    if (!Array.isArray(files) || files.some((file) => typeof file !== 'string')) {
      throw new Error('The desktop did not report template filenames.')
    }
    state.files = files
  } catch (error) {
    state.error = websiteError(error)
  } finally {
    state.loading = false
  }
}

function refresh() {
  for (const source of rewriteTemplateSources) void discover(source)
}

async function read(template: RewriteTemplate) {
  const { source, filename } = template
  const key = `${source}:${filename}`
  const pending = reads.get(key)
  if (pending) return pending
  const operation = request('readNginxRewriteTemplate', source, filename).then((content) => {
    if (typeof content !== 'string') throw new Error('The desktop did not report template content.')
    return content
  })
  reads.set(key, operation)
  try {
    return await operation
  } finally {
    reads.delete(key)
  }
}

async function openFolder() {
  if (folder.opening) return
  folder.opening = true
  try {
    const path = await request('prepareNginxRewriteTemplateDirectory')
    if (typeof path !== 'string' || !path)
      throw new Error('The desktop did not report the template folder.')
    const error = await shell.openPath(path)
    if (error) throw new Error(error)
  } catch (error) {
    showNotice(websiteError(error))
  } finally {
    folder.opening = false
  }
}

export const rewriteTemplatesController = { catalog, folder, refresh, read, openFolder }
