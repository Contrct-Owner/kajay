import { expect, test } from '@playwright/test';
import { gotoLogicShowcase } from './support/navigate.js';

/**
 * Validation — checklist §D, through the running demo.
 *
 * The demo carries the policy controls a real host would set in its definition, which
 * is what makes each `checkErrorsMode` observable in one application rather than
 * requiring three.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('parity/D1-required', async ({ page }) => {
  await page.getByRole('button', { name: 'Next' }).click();

  // Still on page one, and the definition's own wording is what the respondent reads.
  await expect(page.getByTestId('page-position')).toHaveText('Page 1 of 2');
  await expect(page.getByRole('alert')).toHaveText('We need a name to address you by.');

  // Answering it makes the nickname required in turn — `requiredIf` and `isRequired`
  // reach the same gate, which is the point of the override living on the model.
  await page.getByLabel(/What is your name\?/u).fill('Ada');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('alert')).toHaveText('This question requires an answer.');
  await expect(page.getByTestId('page-position')).toHaveText('Page 1 of 2');

  await page.getByLabel(/What should we call you\?/u).fill('Ada');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Logic showcase' })).toBeVisible();
});

test('parity/D6-focus-first-error', async ({ page }) => {
  await page.getByRole('button', { name: 'Next' }).click();

  // The respondent's focus was on Next. Leaving it there means hunting for the problem.
  await expect(page.getByLabel(/What is your name\?/u)).toBeFocused();
});

test('parity/D2-email-validator', async ({ page }) => {
  await page.getByLabel(/What is your name\?/u).fill('Ada');
  await page.getByLabel(/What should we call you\?/u).fill('Ada');
  await page.getByLabel('Email address').fill('ada.example.com');

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('alert')).toHaveText('Please enter a valid email address.');
  await expect(page.getByLabel('Email address')).toHaveAttribute('aria-invalid', 'true');

  await page.getByLabel('Email address').fill('ada@example.com');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Logic showcase' })).toBeVisible();
});

test('parity/D5-check-errors-mode', async ({ page }) => {
  await page.getByLabel('When to check').selectOption('onValueChanged');
  await gotoLogicShowcase(page);
  await page.getByLabel('paid').check();

  // No Next pressed: the bound is reported as the answer changes.
  await page.getByLabel('Monthly price').fill('5000');
  await expect(page.getByRole('alert')).toHaveText(
    'Please enter a value no greater than 1000.',
  );

  await page.getByLabel('Monthly price').fill('42');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('parity/D5-error-location', async ({ page }) => {
  await page.getByLabel('Error position').selectOption('bottom');
  await page.getByRole('button', { name: 'Next' }).click();

  const question = page.locator('[data-question-name="fullName"]');
  const errorBox = await question.locator('.kajay-question__errors').boundingBox();
  const inputBox = await question.locator('input').boundingBox();

  expect(errorBox?.y ?? 0).toBeGreaterThan(inputBox?.y ?? 0);
});

test('parity/D6-validation-enabled', async ({ page }) => {
  await page.getByLabel('Validation enabled').uncheck();
  await page.getByRole('button', { name: 'Next' }).click();

  // The required name is still unanswered; with validation off it stops blocking, and
  // nothing is reported either — the check does not run at all.
  await expect(page.getByRole('heading', { name: 'Logic showcase' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('parity/D3-async-validators', async ({ page }) => {
  await page.getByLabel(/What is your name\?/u).fill('Ada');
  await page.getByLabel(/What should we call you\?/u).fill('admin');
  await page.getByRole('button', { name: 'Next' }).click();

  // A check the host registered, answering out of process. The button says so.
  await expect(page.getByRole('button', { name: 'Checking…' })).toBeDisabled();
  await expect(page.getByRole('alert')).toHaveText('"admin" is already taken.');
  await expect(page.getByTestId('page-position')).toHaveText('Page 1 of 2');

  await page.getByLabel(/What should we call you\?/u).fill('Ada');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Logic showcase' })).toBeVisible();
});

test('parity/D4-server-validation', async ({ page }) => {
  await gotoLogicShowcase(page);
  await page.getByLabel('paid').check();
  await page.getByLabel('Monthly price').fill('13');

  await page.getByRole('button', { name: 'Complete' }).click();

  // The objection came from the host's server hook, and landed on the question it named.
  await expect(page.getByRole('alert')).toHaveText('Our billing system refuses 13. Sorry.');
  await expect(page.getByTestId('page-position')).toHaveText('Page 2 of 2');

  await page.getByLabel('Monthly price').fill('42');
  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('status')).toContainText('Thank you');
});

test('parity/D5-validation-scope', async ({ page }) => {
  await gotoLogicShowcase(page);
  await page.getByLabel('paid').check();
  await page.getByLabel('Monthly price').fill('5000');

  // Complete is refused by page two's own bound; page one's answers are not re-reported.
  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('alert')).toHaveText('Please enter a value no greater than 1000.');
  await expect(page.getByTestId('page-position')).toHaveText('Page 2 of 2');
});
