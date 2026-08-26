import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const classicScriptOutput = (): Plugin => ({
  name: 'classic-script-output',
  apply: 'build',
  enforce: 'post',
  transformIndexHtml: (html) => html
    .replace(/<script type="module"([^>]*)>/g, '<script defer$1>')
    .replace(/<script crossorigin/g, '<script'),
})

export default defineConfig({
  base: './',
  plugins: [react(), classicScriptOutput()],
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        format: 'iife',
      },
    },
  },
})
