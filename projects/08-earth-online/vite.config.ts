import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createEarthContentPlugin } from './vite.content-plugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [createEarthContentPlugin({ archiveMode: 'lazy' }), react()],
})
