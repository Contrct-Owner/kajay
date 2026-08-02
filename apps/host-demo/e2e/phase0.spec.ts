import { expect, test } from '@playwright/test';

/**
 * Parity scenarios. A checklist row goes green only through a passing scenario named
 * for it — never by assertion in a document.
 *
 * These run against the built host-demo, which consumes the packages exclusively
 * through their published exports.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('parity/A1-unknown-properties-surfaced', async ({ page }) => {
  const diagnostics = page.getByTestId('diagnostics');
  await expect(diagnostics.locator('[data-code="unknown-property"]')).toHaveCount(1);
  await expect(diagnostics).toContainText('department');
  await expect(diagnostics).toContainText('preserved');
});

test('parity/A2-round-trip-fixed-point', async ({ page }) => {
  await expect(page.getByTestId('round-trip-status')).toHaveText('Round-trip is a fixed point');

  const canonical = await page.getByTestId('canonical-json').textContent();
  const parsed = JSON.parse(canonical ?? '{}') as Record<string, unknown>;

  // The unknown property survived, and the canonical form carries its version.
  expect(JSON.stringify(parsed)).toContain('"department":"engineering"');
  expect(parsed['schemaVersion']).toBe(1);
});

test('parity/A7-value-changed-event', async ({ page }) => {
  await page.getByLabel(/What is your name\?/u).fill('Ada Lovelace');
  await expect(page.getByTestId('survey-data')).toContainText('Ada Lovelace');
});

test('parity/C1-text-question-renders', async ({ page }) => {
  const input = page.getByLabel(/What is your name\?/u);
  await expect(input).toBeVisible();
  await expect(input).toHaveAttribute('placeholder', 'Ada Lovelace');
  await expect(input).toHaveAttribute('aria-required', 'true');
});

test('parity/B3-visible-if', async ({ page }) => {
  const nickname = page.getByLabel('What should we call you?');
  await expect(nickname).toHaveCount(0);

  await page.getByLabel(/What is your name\?/u).fill('Ada Lovelace');
  await expect(nickname).toBeVisible();

  await page.getByLabel(/What is your name\?/u).fill('');
  await expect(nickname).toHaveCount(0);
});

test('parity/B4-enable-if', async ({ page }) => {
  const email = page.getByLabel('Email address');
  await expect(email).toBeDisabled();

  await page.getByLabel(/What is your name\?/u).fill('Ada Lovelace');
  await page.getByLabel('What should we call you?').fill('Ada');
  await expect(email).toBeEnabled();

  await page.getByLabel('What should we call you?').fill('');
  await expect(email).toBeDisabled();
});

test('parity/B4-required-if', async ({ page }) => {
  await page.getByLabel(/What is your name\?/u).fill('Ada Lovelace');
  await expect(page.getByLabel('What should we call you?')).toHaveAttribute(
    'aria-required',
    'true',
  );
});

test('parity/B5-default-value-expression', async ({ page }) => {
  await page.getByLabel(/What is your name\?/u).fill('Ada Lovelace');
  await page.getByLabel('What should we call you?').fill('Ada');

  const greeting = page.getByLabel('How we will greet you');
  await expect(greeting).toHaveValue('Hello, Ada');

  // Still tracking, because nobody has overridden it.
  await page.getByLabel('What should we call you?').fill('Ada L');
  await expect(greeting).toHaveValue('Hello, Ada L');

  // Typed over: now it belongs to the respondent and stops following.
  await greeting.fill('Hi there');
  await page.getByLabel('What should we call you?').fill('Augusta');
  await expect(greeting).toHaveValue('Hi there');
});

test('parity/E5-completion-flow', async ({ page }) => {
  await page.getByLabel(/What is your name\?/u).fill('Ada');
  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('status')).toContainText('Thank you');
});

test('parity/I1-theme-tokens-applied', async ({ page }) => {
  // Proves the host's `@kajay/themes/styles.css` import resolved through the exports map.
  const radius = await page
    .locator('.kajay-survey')
    .evaluate((element) => getComputedStyle(element).getPropertyValue('--kajay-radius').trim());
  expect(radius).toBe('8px');
});
