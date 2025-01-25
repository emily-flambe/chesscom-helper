import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // Ensure Vite binds to all available network interfaces
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,  // Useful if you're using Docker on macOS/Windows
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
