import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadIsolated } from './helpers/load-isolated'

const root = join(import.meta.dirname, '..')
const controller = readFileSync(join(root, 'src/render-next/state/projectWorkflowController.ts'), 'utf8')
const panel = readFileSync(join(root, 'src/render-next/components/ProjectWorkflowPanel.vue'), 'utf8')
const websites = readFileSync(join(root, 'src/render-next/screens/WebsitesScreen.vue'), 'utf8')
for (const source of [controller, panel, websites]) assert.ok(source.length > 0)
assert.ok(controller.includes('reactiveBind(new ProjectWorkflowController())'))
assert.ok(controller.includes('ProjectSetup(kind, { initializeDirectories: false })'))
assert.ok(controller.includes("node: 'Node.js'"))
assert.ok(panel.includes('<LanguageProjectManager'))
assert.ok(controller.includes('private actionFlights = new Map'))
assert.ok(controller.includes('project.item.start()'))
assert.ok(controller.includes('project.item.stop()'))
assert.ok(panel.includes('projectWorkflowController as controller'))
assert.ok(panel.includes("controller.run(project, 'start')"))
assert.ok(panel.includes("controller.run(project, 'stop')"))
assert.match(websites, /<ProjectWorkflowPanel\b/)
assert.ok(websites.includes('<VhostTemplatePanel'))

const templateDirectory = join(root, 'fixture-data', 'VhostTemplate')
const customApache = join(templateDirectory, 'apache.vhost')
const bundledNginx = join(root, 'fixture-static', 'tmpl', 'nginx.vhost')
const customNginx = join(templateDirectory, 'nginx.vhost')
const files = new Map([[bundledNginx, '# bundled Nginx']])
const reads: string[] = []
const writes: Array<[string, string]> = []
const notices: string[] = []
const reveals: string[] = []
const projectLoads: string[] = []
const javaProject = { id: 'saved-java', path: '/fixture/Java project' }
const javaSource = {
  project: [javaProject],
  fetched: false,
  async fetchProject() {
    this.fetched = true
  }
}
const dotnetSource = { project: [], fetched: false, async fetchProject() {} }
let piniaReady = false
const { projectWorkflowController: workflows } = await loadIsolated(
  join(root, 'src/render-next/state/projectWorkflowController.ts'),
  {
    '@/util/Index': {
      reactiveBind: <T extends object>(value: T) => {
        for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(value))) {
          Reflect.get(value, key)
        }
        return value
      }
    },
    '@/util/NodeFn': {},
    '@/util/Project': {},
    '@/components/LanguageProjects/setup': {
      ProjectSetup: (kind: string, options: { initializeDirectories: boolean }) => {
        assert.equal(options.initializeDirectories, false)
        projectLoads.push(kind)
        return kind === 'java' ? javaSource : dotnetSource
      }
    },
    '@/components/LanguageProjects/ports': {},
    '@/store/brew': {},
    '../moduleVisibility/visibility': {
      isBuiltinModuleVisible: (kind: string) => {
        assert.equal(piniaReady, true, 'visibility must wait for Pinia initialization')
        return ['java', 'dotnet'].includes(kind)
      }
    },
    './app': {}
  }
)
piniaReady = true
assert.equal(await workflows.load(), false)
assert.deepEqual(projectLoads.sort(), ['dotnet', 'java'])
assert.match(workflows.error, /Could not load projects for \.NET/)
assert.equal(workflows.count('java'), 1)
assert.equal(workflows.count('dotnet'), undefined)
assert.equal(workflows.listProjects()[0].item, javaProject)

const { vhostTemplateController: templates } = await loadIsolated(
  join(root, 'src/render-next/state/vhostTemplateController.ts'),
  {
    '@/util/Index': { reactiveBind: <T>(value: T) => value },
    '@/util/path-browserify': { join },
    '@/util/NodeFn': {
      fs: {
        readFileStrict: async (file: string) => {
          reads.push(file)
          if (file === customApache) throw Object.assign(new Error('Access denied'), { code: 'EACCES' })
          if (!files.has(file)) throw Object.assign(new Error('Missing file'), { code: 'ENOENT' })
          return files.get(file)
        },
        mkdirp: async (directory: string) => assert.equal(directory, templateDirectory),
        writeFile: async (file: string, content: string) => {
          writes.push([file, content])
          files.set(file, content)
        }
      },
      shell: { showItemInFolder: async (file: string) => reveals.push(file) }
    },
    '../websites/types': { websiteError: (error: Error) => error.message },
    './app': { showNotice: (message: string) => notices.push(message) }
  },
  { window: { Server: { BaseDir: join(root, 'fixture-data'), Static: join(root, 'fixture-static') } } }
)

const nginx = await templates.load('nginx')
await templates.reveal(nginx.source)
assert.deepEqual(reveals, [bundledNginx])
await assert.rejects(templates.load('apache'), /Access denied/)
assert.equal(reads.at(-1), customApache, 'a permission failure must not load the bundled template')

files.set(customNginx, '# external change')
assert.match(await templates.save(nginx, '# draft'), /changed on disk/)
assert.deepEqual(writes, [], 'a custom template created after reading the default must survive')
const current = await templates.load('nginx')
const save = templates.save(current, '# selected draft')
assert.match(await templates.save(current, '# duplicate draft'), /already running/)
assert.equal(await save, undefined)
assert.deepEqual(writes, [[customNginx, '# selected draft']])
assert.deepEqual(notices, ['Nginx HTTP template saved.'])
console.log('PQT Forge project workflows smoke passed (saved language projects and real lifecycle controls).')
