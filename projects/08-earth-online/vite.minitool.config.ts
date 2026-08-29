import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { createEarthContentPlugin } from './vite.content-plugin.ts'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

function emitMinitoolHtml(): Plugin {
  return {
    name: 'emit-minitool-html',
    generateBundle(_options, bundle) {
      const output = Object.values(bundle)
      const entry = output.find((item) => item.type === 'chunk' && item.isEntry)
      if (!entry) {
        const emitted = output.map((item) => `${item.type}:${item.fileName}`).join(', ')
        throw new Error(`Minitool build must emit one entry script; received ${emitted}`)
      }

      this.emitFile({
        type: 'asset',
        fileName: 'index.html',
        source: `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <link rel="stylesheet" href="./assets/style.css" />
    <title>地球 Online</title>
  </head>
  <body>
    <div id="root"></div>
    <script src="./${entry.fileName}"></script>
  </body>
</html>
`,
      })
    },
  }
}

function removeUnavailableReactConnectionProbe(): Plugin {
  return {
    name: 'remove-unavailable-react-connection-probe',
    enforce: 'pre',
    transform(source, id) {
      if (!id.includes('/react-dom/') || !source.includes('navigator.connection')) return undefined
      return { code: source.replaceAll('navigator.connection', 'undefined'), map: null }
    },
  }
}

export default defineConfig({
  base: './',
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [createEarthContentPlugin({ archiveMode: 'eager' }), removeUnavailableReactConnectionProbe(), react(), emitMinitoolHtml()],
  build: {
    outDir: 'dist-minitool',
    emptyOutDir: true,
    copyPublicDir: true,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('src/main.tsx', import.meta.url)),
      name: 'EarthOnline',
      formats: ['iife'],
      fileName: () => 'assets/app.js',
      cssFileName: 'assets/style',
    },
  },
  resolve: {
    alias: {
      '@': projectRoot,
    },
  },
})
