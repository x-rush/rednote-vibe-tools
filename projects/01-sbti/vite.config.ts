import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { toMiniToolHtml, toMiniToolScript } from './src/ui/minitoolArtifact.ts'

function miniToolArtifactPlugin(): Plugin {
  return {
    name: 'mini-tool-classic-entry',
    enforce: 'post',
    renderChunk(code) {
      const miniToolCode = toMiniToolScript(code)
      return miniToolCode === code ? null : { code: miniToolCode, map: null }
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
  },
})
