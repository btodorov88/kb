import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Fixed port so it doesn't clash with other local Vite projects (fails loudly if taken)
  server: {
    port: 5180,
    strictPort: true,
    // API server (server/index.ts) runs on 5181 in development
    proxy: { '/api': 'http://127.0.0.1:5181' },
  },
})
