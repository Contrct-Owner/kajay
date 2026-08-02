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

test('parity/B6-calculated-values', async ({ page }) => {
  const answers = page.getByTestId('survey-data');

  await page.getByLabel(/What is your name\?/u).fill('Ada Lovelace');
  await expect(answers).toContainText('"answeredCount": 1');

  await page.getByLabel('What should we call you?').fill('Ada');
  await expect(answers).toContainText('"answeredCount": 2');
});

test('parity/B7-triggers', async ({ page }) => {
  const status = page.getByLabel('Status');
  await expect(status).toHaveCount(0);

  await page.getByLabel(/What is your name\?/u).fill('Ada Lovelace');
  await page.getByLabel('What should we call you?').fill('Ada');
  await expect(status).toHaveCount(0);

  // Third answer takes answeredCount to 3, and the trigger fires once.
  await page.getByLabel('Email address').fill('ada@example.com');
  await expect(status).toHaveValue('complete');
});

test('parity/C3-C4-select-questions', async ({ page }) => {
  await page.getByLabel('engineering').check();
  await page.getByLabel('design').check();
  await expect(page.getByTestId('survey-data')).toContainText('"engineering"');

  // `none` is exclusive: choosing it clears the rest.
  await page.getByLabel('None').check();
  const answers = await page.getByTestId('survey-data').textContent();
  expect(JSON.parse(answers ?? '{}')['topics']).toEqual(['none']);
});

test('parity/B3-visible-if-choice', async ({ page }) => {
  await expect(page.getByLabel('management')).toHaveCount(0);
  await page.getByLabel('Manager').check();
  await expect(page.getByLabel('management')).toBeVisible();
});

test('parity/B10-rest-choices', async ({ page }) => {
  // The request is intercepted rather than left to hit the real service: the app's own
  // fetch path still runs end to end, but CI never depends on a third party being up.
  await page.route('https://jsonplaceholder.typicode.com/users', async (route) => {
    await route.fulfill({
      json: [
        { id: 7, name: 'Fixture Person' },
        { id: 8, name: 'Second Person' },
      ],
    });
  });
  await page.reload();

  const contact = page.getByLabel('Who should we contact?');
  // Two loaded choices plus the placeholder.
  await expect(contact.locator('option')).toHaveCount(3);
  await expect(contact).toContainText('Fixture Person');

  await contact.selectOption('7');
  await expect(page.getByTestId('survey-data')).toContainText('"contact": "7"');
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
