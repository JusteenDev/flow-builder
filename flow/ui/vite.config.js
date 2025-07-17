import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5173',        // Proxy trace data
      '/socket.io': {
        target: 'ws://localhost:5173',        // WebSocket proxy
        ws: true,
      },
      '^/ws': {
        target: 'ws://localhost:5173',
        ws: true,
      }
    }
  },
})
