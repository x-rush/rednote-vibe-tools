import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'minitool-classic-script',
      transformIndexHtml: {
        order: 'post',
        handler(html, context) {
          if (context.server) return html
          return html.replace(/<script type="module" crossorigin src=/g, '<script defer src=')
        },
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        format: 'iife',
      },
    },
  },
})
