import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'remove-unavailable-react-connection-probe',
      enforce: 'pre',
      transform(source, id) {
        if (!id.includes('/react-dom/') || !source.includes('navigator.connection')) return undefined
        return { code: source.replaceAll('navigator.connection', 'undefined'), map: null }
      },
    },
    react(),
    {
      name: 'minitool-classic-script',
      apply: 'build',
      enforce: 'post',
      transformIndexHtml(html) {
        return html.replace('<script type="module" crossorigin', '<script defer')
      },
    },
  ],
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        format: 'iife',
      },
    },
  },
})
