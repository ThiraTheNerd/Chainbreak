import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Docker Compose sets this to http://server:3000 (the service name, not
// "localhost") so the proxy still resolves when the client container is hit
// directly on its published 5173 port, bypassing nginx. Native/non-Docker
// dev falls back to the server on the host's own localhost.
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000'

export default defineConfig({
  base: '/', // Ensures assets resolve from root domain
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Vite rejects requests whose Host header isn't on this list. Covers
    // local dev (bare IP/hostname access) and the production domain
    // (reached through nginx, which forwards the real Host header).
    allowedHosts: ['localhost', '127.0.0.1', 'dissertation.mercythira.com'],
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/socket.io': {
        target: apiProxyTarget,
        ws: true,
        changeOrigin: true,
      },
    },
    // Prevents ZAP payloads from blowing up the UI during active scanning
    hmr: {
      overlay: false
    }
  },
})
