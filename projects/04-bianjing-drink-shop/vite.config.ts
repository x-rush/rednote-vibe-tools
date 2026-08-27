import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const minitool = mode === 'minitool'
  return {
    base: './',
    plugins: [react()],
    build: {
      target: 'es2018',
      modulePreload: minitool ? false : undefined,
      outDir: minitool ? 'dist-minitool' : 'dist',
      rollupOptions: minitool ? {
        output: {
          format: 'iife',
          name: 'BianjingDrinkShop',
          entryFileNames: 'assets/app.js',
          chunkFileNames: 'assets/chunk-[name].js',
          assetFileNames: 'assets/[name][extname]',
        },
      } : undefined,
    },
  }
})
