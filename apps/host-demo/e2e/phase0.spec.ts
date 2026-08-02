import { expect, test } from '@playwright/test';
import { gotoLogicShowcase } from './support/navigate.js';

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
  await expect(page.getByTestId('survey-data')).toContainText('"contact": 7');
});

test('parity/B5-set-value-if', async ({ page }) => {
  await gotoLogicShowcase(page);
  await page.getByLabel('paid').check();
  await page.getByLabel('Monthly price').fill('99');

  // The condition becomes true, and the trigger overwrites what was typed.
  await page.getByLabel('free').check();
  await expect(page.getByLabel('Monthly price')).toHaveValue('0');
});

test('parity/B5-reset-value-if', async ({ page }) => {
  await gotoLogicShowcase(page);
  await page.getByLabel('paid').check();
  await page.getByLabel('Billing notes').fill('invoice quarterly');

  await page.getByLabel('free').check();
  await expect(page.getByLabel('Billing notes')).toHaveValue('');
});

test('parity/B9-carry-forward-choices', async ({ page }) => {
  await gotoLogicShowcase(page);
  const primary = page.getByLabel('Which topic matters most?');
  // Nothing chosen upstream, so nothing to carry forward but the placeholder.
  await expect(primary.locator('option')).toHaveCount(1);

  // The source question is a page back: carry-forward reaches across pages, which is
  // exactly the case a single-page demo could not have shown.
  await page.getByRole('button', { name: 'Previous' }).click();
  await page.getByLabel('engineering').check();
  await page.getByLabel('design').check();
  await gotoLogicShowcase(page);
  await expect(primary.locator('option')).toHaveCount(3);
  await expect(primary).toContainText('engineering');

  // Deselecting upstream withdraws the option here.
  await page.getByRole('button', { name: 'Previous' }).click();
  await page.getByLabel('design').uncheck();
  await gotoLogicShowcase(page);
  await expect(primary.locator('option')).toHaveCount(2);
});

test('parity/B7-trigger-runexpression', async ({ page }) => {
  await gotoLogicShowcase(page);
  // `free` first, because the billing panel only exists once a plan is chosen and the
  // trigger fires on the *transition* into paid — the price has to be there already.
  await page.getByLabel('free').check();
  await page.getByLabel('Monthly price').fill('10');

  await page.getByLabel('paid').check();
  await expect(page.getByLabel('Annual estimate')).toHaveValue('120');
});

test('parity/B7-trigger-copyvalue', async ({ page }) => {
  await page.getByLabel(/What is your name\?/u).fill('Ada Lovelace');
  await page.getByLabel('engineering').check();
  await gotoLogicShowcase(page);
  await page.getByLabel('Which topic matters most?').selectOption('engineering');

  await expect(page.getByLabel('Name on file')).toHaveValue('Ada Lovelace');
});

test('parity/B7-trigger-complete', async ({ page }) => {
  await gotoLogicShowcase(page);
  await expect(page.getByRole('status')).toHaveCount(0);
  // `click`, not `check`: completing unmounts the whole form, so there is no longer a
  // radio for `check` to confirm ended up selected.
  await page.getByLabel('Yes, finish now').click();
  await expect(page.getByRole('status')).toContainText('Thank you');
});
