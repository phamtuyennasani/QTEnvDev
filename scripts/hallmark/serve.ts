import { createServer } from 'vite'
import config from '../../configs/vite.config'
import { resolve } from 'node:path'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { buildSync } from 'esbuild'

// Keep fixture workers isolated from the running app's Monaco cache. The upstream
// dev middleware uses recursive rmdir, which Node 26 no longer supports.
const require = createRequire(import.meta.url)
const workerCache = resolve('tmp/hallmark/monaco')
const { languageWorkAttr } = require('vite-plugin-monaco-editor/dist/lnaguageWork')
const plugins = config.serverConfig.plugins!.map((plugin: any) => {
  if (plugin?.name !== 'vite-plugin-moncao-editor') return plugin
  return {
    ...plugin,
    configureServer(server: any) {
      mkdirSync(workerCache, { recursive: true })
      for (const { entry } of languageWorkAttr) {
        const filename = entry.split('/').at(-1) + '.bundle.js'
        server.middlewares.use('/monacoeditorwork/' + filename, (_request: any, response: any) => {
          const outfile = resolve(workerCache, filename)
          if (!existsSync(outfile)) {
            buildSync({ entryPoints: [require.resolve(entry)], bundle: true, outfile })
          }
          response.setHeader('Content-Type', 'text/javascript')
          response.end(readFileSync(outfile))
        })
      }
    }
  }
})
const previewPath = resolve('scripts/hallmark/preview.ts').replaceAll('\\', '/')
const server = await createServer({
  ...config.serverConfig,
  configFile: false,
  cacheDir: resolve('tmp/hallmark/vite-cache'),
  optimizeDeps: { ...config.serverConfig.optimizeDeps, exclude: ['monaco-editor'] },
  server: { port: 5201, host: '127.0.0.1', strictPort: true, fs: { allow: [process.cwd()] } },
  plugins: [
    ...plugins,
    {
      name: 'hallmark-fixture',
      configureServer(server) {
        server.middlewares.use('/hallmark-preview', async (_request, response) => {
          response.setHeader('Content-Type', 'text/html')
          response.end(
            await server.transformIndexHtml(
              '/hallmark-preview',
              `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div><script type="module" src="/@fs/${previewPath}"></script></body></html>`
            )
          )
        })
      }
    }
  ]
})
await server.listen()
console.log('Hallmark renderer fixture: http://127.0.0.1:5201/hallmark-preview')
