import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'offline-classic-script',
      apply: 'build',
      enforce: 'post',
      transformIndexHtml: {
        order: 'post',
        handler(html) {
          return html.replace('<script type="module" crossorigin src=', '<script defer src=')
        },
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'assets/app.js',
      },
    },
  },
})
