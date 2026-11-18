import type { UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import * as path from 'path'
import { ViteDevPort } from './vite.port'
import vueJsx from '@vitejs/plugin-vue-jsx'
import wasm from 'vite-plugin-wasm'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { createRequire } from 'node:module'
import { ElementPlusLocaleModules } from './element-plus-locales'
const require = createRequire(import.meta.url)

const __dirname = dirname(fileURLToPath(import.meta.url))

const renderPath = path.resolve(__dirname, '../src/render/')
const sharePath = path.resolve(__dirname, '../src/shared/')
const langPath = path.resolve(__dirname, '../src/lang/')

const monacoEditorPlugin = require('vite-plugin-monaco-editor').default

// Monaco injects an inline worker map; Shiki and formatters use WebAssembly.
const rendererContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: file: http: https:",
  "font-src 'self' data:",
  "connect-src 'self' http: https: ws: wss:",
  "worker-src 'self' blob:",
  "media-src 'self' data: blob: file:",
  "object-src 'none'",
  "base-uri 'self'"
].join('; ')

const config: UserConfig = {
  base: './',
  plugins: [
    monacoEditorPlugin({}),
    wasm(),
    vue({
      include: [/\.vue$/, /\.md$/] // <-- allows Vue to compile Markdown files
    }),
    vueJsx({
      transformOn: true,
      mergeProps: true
    }),
    {
      name: 'renderer-content-security-policy',
      transformIndexHtml: {
        order: 'post',
        handler: () => [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: rendererContentSecurityPolicy
            },
            injectTo: 'head-prepend'
          }
        ]
      }
    }
  ],
  esbuild: {
    jsx: 'preserve',
    target: 'esnext',
    supported: {
      'top-level-await': true
    }
  },
  assetsInclude: ['**/*.node'],
  optimizeDeps: {
    include: [...ElementPlusLocaleModules],
    esbuildOptions: {
      jsx: 'preserve',
      target: 'esnext',
      supported: {
        'top-level-await': true
      }
    }
  },
  root: renderPath,
  resolve: {
    alias: {
      '@': renderPath,
      '@shared': sharePath,
      '@lang': langPath
    }
  },
  css: {
    // CSS preprocessor
    preprocessorOptions: {
      scss: {}
    }
  }
}

const serverConfig: UserConfig = {
  server: {
    port: ViteDevPort,
    hmr: true
  },
  ...config,
  // Dev serves both independent renderers from the shared src root.
  // Production builds remain separately configured below.
  root: path.resolve(__dirname, '../src')
}

const serveConfig: UserConfig = {
  server: {
    port: ViteDevPort,
    open: true,
    hmr: true
  },
  ...config
}

const buildConfig: UserConfig = {
  mode: 'production',
  build: {
    outDir: '../../dist/render',
    assetsDir: 'static',
    commonjsOptions: {
      transformMixedEsModules: true,
      ignoreDynamicRequires: true
    },
    rollupOptions: {
      external: [],
      input: {
        main: path.resolve(__dirname, '../src/render/index.html'),
        next: path.resolve(__dirname, '../src/render-next/next.html'),
        tray: path.resolve(__dirname, '../src/render/tray.html'),
        capturer: path.resolve(__dirname, '../src/render/capturer/capturer.html')
      },
      output: {
        entryFileNames: 'static/js/[name].[hash].js',
        chunkFileNames: 'static/js/[name].[hash].js',
        assetFileNames: 'static/[ext]/[name].[hash].[ext]',
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/')
          const elementLocale = normalizedId.match(/element-plus\/es\/locale\/lang\/([^/.]+)/)
          if (elementLocale) {
            return `element-plus-locale-${elementLocale[1]}`
          }
          if (id.includes('node_modules')) {
            return id.toString().split('node_modules/')[1].split('/')[0].toString()
          }
          return undefined
        }
      }
    },
    minify: 'esbuild'
  },
  ...config,
  ...{
    esbuild: {
      jsx: 'preserve',
      target: 'esnext',
      supported: {
        'top-level-await': true
      },
      drop: ['console', 'debugger']
    }
  }
}

const renderNextPath = path.resolve(__dirname, '../src/render-next/')
const nextBuildConfig: UserConfig = {
  ...config,
  root: renderNextPath,
  build: {
    outDir: '../../dist/render',
    emptyOutDir: false,
    assetsDir: 'static',
    rollupOptions: {
      input: path.resolve(renderNextPath, 'next.html'),
      output: {
        entryFileNames: 'static/js/next.[hash].js',
        chunkFileNames: 'static/js/next-[name].[hash].js',
        assetFileNames: 'static/[ext]/next-[name].[hash].[ext]'
      }
    },
    minify: 'esbuild'
  },
  resolve: {
    alias: {
      '@': renderPath,
      '@shared': sharePath,
      '@lang': langPath
    }
  }
}

export default {
  serveConfig,
  serverConfig,
  buildConfig,
  nextBuildConfig
}
