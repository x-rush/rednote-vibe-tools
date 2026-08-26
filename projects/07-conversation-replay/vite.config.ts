import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [
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
