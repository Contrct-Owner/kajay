import { defineConfig, devices } from '@playwright/test';

// Parity scenarios run against the built host-demo, i.e. the same artifact a consumer
// would deploy. Scenario titles carry checklist ids (`parity/<row-id>-<slug>`).
export default defineConfig({
  testDir: './apps/host-demo/e2e',
  // Deterministic sharding by sorted file, so CI can add shards without changing
  // behaviour. Full parallelism: no scenario may depend on another's state.
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `preview` serves whatever is already in the demo's `dist`. Building is the
    // `test:e2e` script's job and is repeated here so that running Playwright directly
    // cannot silently test a stale bundle — which it did once, reporting the old
    // string-typed REST answer long after the fix had landed.
    command:
      'pnpm --filter @kajay/host-demo run build && pnpm --filter @kajay/host-demo run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
