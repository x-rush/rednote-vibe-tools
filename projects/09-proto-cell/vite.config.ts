import { baselineCss } from './scripts/css-baseline.ts'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  build: {
    target: ['es2017', 'chrome61'],
    cssTarget: ['chrome61'],
    modulePreload: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [
    { name: 'minitool-css-baseline', enforce: 'pre', transform(source, id) { if (id.endsWith('.css')) return { code: baselineCss(source), map: null } } },
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
        return html.replace('<script type="module" crossorigin', '<script defer').replace('<script defer', '<script src="./compat.js"></script><script defer')
      },
    },
  ],
})
