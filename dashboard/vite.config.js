import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API (and the store + tracker) run on :4000 in development.
const API = process.env.API_PROXY_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  // Served by the backend under /dashboard/ in production; use the same base in dev
  // so links and the router basename behave identically.
  base: '/dashboard/',
  server: {
    port: 5173,
    proxy: {
      '/api': API,
      '/store': API,
      '/tracker.js': API,
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
  },
});
