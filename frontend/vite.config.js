import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const config = loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), '')
  const base = mode === 'production' ? (config.APP_BASE_PATH || '/somtop/') : '/'
  const backend = `http://127.0.0.1:${config.PORT || 8000}`
  return ({
  base,
  plugins: [
    vue(),
    mode === 'development' && vueDevTools(),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': backend,
      '/uploads': backend,
    },
  },
  })
})
