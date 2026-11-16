import { createServer } from 'vite'
import config from '../../configs/vite.config'
import { resolve } from 'node:path'
const previewPath = resolve('scripts/hallmark/preview.ts').replaceAll('\\', '/')
const server = await createServer({
  ...config.serverConfig,
  configFile: false,
  server: { port: 5201, host: '127.0.0.1', strictPort: true, fs: { allow: [process.cwd()] } },
  plugins: [
    ...config.serverConfig.plugins!,
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
