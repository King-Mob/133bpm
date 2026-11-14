import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Local dev token endpoint (scripts/token-server.mjs). Netlify serves the
      // same path in production via the /api/* redirect in netlify.toml.
      '/api': 'http://localhost:8787',
    },
  },
})
