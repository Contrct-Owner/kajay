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
          // Applications too, not only packages: the reference application has pure logic
          // of its own — a share link's codec — and a proof has to be able to live beside
          // the thing it proves.
          include: ['{packages,apps}/*/test/unit/**/*.test.ts'],
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
          setupFiles: ['./scripts/test-policy/browser-console-guard.mjs'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            // A desktop viewport, stated rather than inherited. F6 made a matrix's
            // layout depend on the window: with whatever width the runner happened to
            // pick, three tests about table markup started asserting against a *list*
            // and it was not obvious why. Tests about the narrow layout ask for it.
            viewport: { width: 1280, height: 800 },
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
