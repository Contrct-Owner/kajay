import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// Two projects with intentionally different jobs, per the development guidelines:
// `unit` is pure logic in Node with no DOM available at all, and `browser` proves
// rendering behaviour in real Chromium. jsdom is banned repo-wide and appears nowhere.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['packages/*/test/unit/**/*.test.ts'],
          // The metadata registry is process-global by design. Tests that register
          // types use unique names and clean up; isolate keeps a leak in one file from
          // being able to reach another.
          isolate: true,
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'browser',
          include: ['packages/*/test/browser/**/*.test.tsx'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
