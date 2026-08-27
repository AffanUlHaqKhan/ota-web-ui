import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies to ota-server's compose stack. With VITE_USE_MOCK=1
// (the default in .env.development) nothing here is used -- the app serves
// itself from the in-memory fake, so the UI is developable with no backend and
// no hardware.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
})
