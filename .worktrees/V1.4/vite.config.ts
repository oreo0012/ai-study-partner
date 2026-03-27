import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  root: 'apps/web',
  plugins: [
    vue(),
    UnoCSS(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./apps/web/src', import.meta.url))
    }
  },
  server: {
    port: 3000,
    host: true,
    watch: {
      ignored: ['**/airi-0.9.0-alpha.1/**', '**/packages/**', '**/node_modules/**']
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
