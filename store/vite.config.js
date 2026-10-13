import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The backend serves the built app at /store (with an index.html fallback for /store/*).
const target = process.env.API_PROXY_TARGET || 'http://localhost:4000';

export default defineConfig({
  base: '/store/',
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': { target, changeOrigin: true },
      '/tracker.js': { target, changeOrigin: true },
    },
  },
  preview: { port: 5174 },
  build: {
    rolldownOptions: {
      output: {
        // Keep React/router/icons and the product catalog in their own long-cacheable chunks.
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules/ },
            { name: 'catalog', test: /src[\\/]data[\\/]products\.json/ },
          ],
        },
      },
    },
  },
});
