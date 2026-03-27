import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: __dirname,
  plugins: [
    vue(),
    UnoCSS({
      configFile: path.resolve(__dirname, 'uno.config.ts')
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api/modelscope': {
        target: 'https://ms-ens-9a3765a1-f587.api-inference.modelscope.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/modelscope/, '/v1')
      },
      '/api/volcengine': {
        target: 'https://openspeech.bytedance.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/volcengine/, '/api/v3/tts'),
        headers: {
          'Connection': 'keep-alive'
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
