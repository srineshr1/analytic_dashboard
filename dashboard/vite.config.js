import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = process.env.API_PROXY_TARGET || 'http://localhost:4000';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Production build is served by the API server under /dashboard/.
  base: command === 'build' ? '/dashboard/' : '/',
  server: {
    port: 5173,
    proxy: {
      '/api': API,
      '/demo': API,
      '/tracker.js': API,
    },
  },
}));
