import { defineConfig, devices } from '@playwright/test';

const sitePort = process.env['KAJAY_SITE_E2E_PORT'] ?? '4174';
const siteUrl = `http://localhost:${sitePort}`;

// Playwright explicitly forces colour for its web server. Some runners also set NO_COLOR;
// remove that conflicting inherited preference before Playwright starts any child process.
delete process.env['NO_COLOR'];

// Acceptance scenarios run against the built Kajay site, i.e. the artifact we deploy.
// This module owns the complete lifecycle: make a fresh artifact, start its server, and
// stop it after Playwright finishes. Root scripts and CI delegate here so direct
// Playwright invocation has the same freshness guarantee.
// Scenario titles carry checklist ids (`parity/<row-id>-<slug>`).
export default defineConfig({
  // Deterministic sharding by sorted file, so CI can add shards without changing
  // behaviour. Full parallelism: no scenario may depend on another's state.
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  // Fewer than Playwright's default (half the cores), and it costs nothing: measured at
  // 68 scenarios, the suite takes ~33s either way, because the limit is each page's own
  // timers rather than how many pages run at once. At the default the machine is
  // oversubscribed and those timers starve — the same starvation the expect timeout
  // below records, and at that width individual scenarios stretched from ~1s to 17-31s
  // and began exceeding the *test* timeout rather than any one assertion's. At two,
  // nothing in the suite exceeds 2.2s.
  workers: 2,
  expect: {
    // Longer than the 5s default, because the whole suite runs alongside a build on one
    // machine and the page's own timers get starved by it. Measured, not
    // guessed: the check timeline recorded a 60ms timer and a 300ms timer both
    // firing at +6.7s under full load, with everything downstream of them correct.
    // The library was never slow; the machine was busy. See the notes on the
    // stuck-"Checking…" investigation.
    timeout: 15_000,
  },
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: siteUrl,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'site',
      testDir: './apps/site/e2e',
      use: { ...devices['Desktop Chrome'], baseURL: siteUrl },
    },
  ],
  // `vite preview` serves the SSR build TanStack Start emits, so the site is exercised as
  // it would be deployed rather than through a dev server. Never reuse an existing server:
  // reuse skips the build and can silently test a stale bundle.
  webServer: {
    command:
      `pnpm --filter @kajay/site run build && pnpm --filter @kajay/site run preview --port ${sitePort} --strictPort`,
    url: siteUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
