import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function toMiniToolHtml(html: string) {
  const moduleEntry = /^[\t ]*<script type="module"(?: crossorigin)? src="(\.\/assets\/[^"]+\.js)"><\/script>\r?\n?/m
  const entryMatch = html.match(moduleEntry)
  if (!entryMatch) throw new Error('Mini-tool build requires one local generated module entry')

  const htmlWithoutModule = html.replace(moduleEntry, '')
  const classicHtml = htmlWithoutModule.replace(
    /^([\t ]*)<\/body>/m,
    `$1  <script src="${entryMatch[1]}"></script>\n$1</body>`,
  )
  if (classicHtml === htmlWithoutModule) throw new Error('Mini-tool build requires a closing body tag')
  return classicHtml
}

function miniToolArtifactPlugin(): Plugin {
  return {
    name: 'mini-tool-classic-entry',
    apply: 'build',
    enforce: 'post',
    renderChunk(code) {
      const compatibleCode = code.replaceAll('navigator.connection', 'undefined')
      return compatibleCode === code ? null : { code: compatibleCode, map: null }
    },
    generateBundle(_options, bundle) {
      const indexHtml = bundle['index.html']
      if (!indexHtml || indexHtml.type !== 'asset' || typeof indexHtml.source !== 'string') {
        throw new Error('Mini-tool build did not emit index.html')
      }
      indexHtml.source = toMiniToolHtml(indexHtml.source)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), miniToolArtifactPlugin()],
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'assets/app.js',
      },
    },
  },
})
