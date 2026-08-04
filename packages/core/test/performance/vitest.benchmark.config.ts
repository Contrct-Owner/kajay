import { defineConfig } from 'vitest/config';

/** Node-only opt-in benchmark config; it deliberately does not start the browser project. */
export default defineConfig({
  test: {
    name: 'dependency-graph-benchmark',
    environment: 'node',
    include: ['packages/core/test/performance/**/*.bench.ts'],
    exclude: ['**/.tsbuild/**', '**/node_modules/**'],
  },
});
