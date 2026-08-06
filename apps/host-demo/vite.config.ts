import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // The demo intentionally exercises the whole public product in one route. Its current
    // minified entry is ~524 kB; keep a tight measured ceiling so real growth still warns.
    chunkSizeWarningLimit: 525,
  },
});
