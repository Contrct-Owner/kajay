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
  expect: {
    // Longer than the 5s default, because the whole suite runs three browsers and a
    // build on one machine and the page's own timers get starved by it. Measured, not
    // guessed: the demo's check timeline recorded a 60ms timer and a 300ms timer both
    // firing at +6.7s under full load, with everything downstream of them correct.
    // The library was never slow; the machine was busy. See the notes on the
    // stuck-"Checking…" investigation.
    timeout: 15_000,
  },
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `preview` serves whatever is already in the demo's `dist`, so the build is part
    // of the command — running Playwright directly must not silently test a stale
    // bundle, which it did once, reporting the old string-typed REST answer long after
    // the fix had landed.
    command:
      'pnpm --filter @kajay/host-demo run build && pnpm --filter @kajay/host-demo run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    // Never reused, in CI or out. Reuse skips the command — and with it the build —
    // so a server left running from an earlier session serves whatever `dist` held
    // then. That reopened the exact hole the line above closes: four scenarios failed
    // against code that had been correct for ten minutes. A few seconds per run is the
    // right price for never debugging that again.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
