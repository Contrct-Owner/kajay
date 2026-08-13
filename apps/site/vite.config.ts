import { cloudflare } from '@cloudflare/vite-plugin';
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
  //
  // **`cloudflare` goes first, and names the environment it is taking over.** The site's
  // server half becomes a Worker rather than a Node process, so `dev` and `preview` run it
  // in `workerd` — the runtime it is actually deployed to. That is a *stronger* claim than
  // the one the E2E suite was already making: it ran the built artifact rather than a dev
  // server, and now runs it in the engine that will serve it, so a Node-only API reaching
  // production fails a scenario here instead of a request there.
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // `PORT` first, so a second agent or terminal working in this repo gets its own dev
  // server instead of colliding on 5174 and silently landing on whatever port Vite picks
  // next — which leaves any tooling that was told the assigned port pointing at nothing.
  // The literal stays the default, so a plain `vite dev` is unchanged.
  server: { port: Number(process.env['PORT']) || 5174 },
  preview: { port: 4174 },
});
