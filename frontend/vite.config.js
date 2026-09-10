import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // On GitHub Pages the app is served from https://<user>.github.io/<repo>/,
  // so the build needs a matching base path. Locally it stays "/".
  // Set VITE_BASE=/grocerygo/ in the Pages build (the deploy workflow does this).
  const base = env.VITE_BASE || '/'

  // Dev-only proxy so the frontend can call "/api/*" without CORS during local dev.
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:3001'

  return {
    base,
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  }
})
