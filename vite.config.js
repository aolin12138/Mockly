import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/frontend/src'),
    },
  },
  server: {
    proxy: {
      '/webhook-test': {
        target: 'https://aolin12138.app.n8n.cloud',
        changeOrigin: true, // Forward origin correctly
        secure: false, // Use false for self-signed certificates
        rewrite: (path) => path.replace(/^\/webhook-test/, ''), // This ensures the full URL is forwarded correctly
      },
    },
  },
});
