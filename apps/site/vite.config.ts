import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Order matters, and the failure is not obvious: without `viteReact` *after*
  // `tanstackStart`, the server renders correctly and the client entry 500s on the React
  // Refresh runtime, so the page looks right and is simply dead. The error message says so
  // plainly once you go looking, which is more than most build stacks manage.
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5174 },
  preview: { port: 4174 },
});
