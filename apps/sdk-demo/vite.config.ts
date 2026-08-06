import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api/dotnet': {
        target: 'http://localhost:5080',
        rewrite: (path) => path.replace(/^\/api\/dotnet/u, '/api'),
      },
      '/api/typescript': {
        target: 'http://localhost:5081',
        rewrite: (path) => path.replace(/^\/api\/typescript/u, '/api'),
      },
      '/openapi/dotnet': {
        target: 'http://localhost:5080',
        rewrite: (path) => path.replace(/^\/openapi\/dotnet/u, '/openapi'),
      },
    },
  },
  preview: { port: 4173 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 550,
  },
});
