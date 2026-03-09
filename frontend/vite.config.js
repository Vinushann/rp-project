import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API requests to backend during development
    proxy: {
      // SSE endpoint needs longer timeout for streaming extraction
      '/api/v1/vishva/extract-stream': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        timeout: 600000,       // 10 minutes for long-running extraction
        proxyTimeout: 600000,  // 10 minutes proxy timeout
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
