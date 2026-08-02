import { expect, test } from '@playwright/test';
import { gotoQuestionTypes } from './support/navigate.js';

/**
 * The question types themselves — checklist §C — on the demo's third page.
 *
 * Split from phase0.spec.ts by subject: what one question type does, rather than what
 * the respondent walks through or what the engine computes.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await gotoQuestionTypes(page);
});

test('parity/C1-input-types', async ({ page }) => {
  await expect(page.getByLabel(/When would you like to start\?/u)).toHaveAttribute(
    'type',
    'date',
  );

  const teamSize = page.getByLabel(/How many people on your team\?/u);
  // The bounds reach the DOM as affordances — a picker offers the right range, a
  // number field steps by one — while the engine owns the message.
  await expect(teamSize).toHaveAttribute('type', 'number');
  await expect(teamSize).toHaveAttribute('min', '1');
  await expect(teamSize).toHaveAttribute('max', '500');
  await expect(teamSize).toHaveAttribute('step', '1');
});

test('parity/C1-numeric-answers-are-numbers', async ({ page }) => {
  await page.getByLabel(/How many people on your team\?/u).fill('12');

  // Not `"12"`. A number input reports a string, and which type reaches `data` must
  // not depend on the adapter that happened to be mounted.
  await expect(page.getByTestId('survey-data')).toContainText('"teamSize": 12');
});

test('parity/C1-text-bounds', async ({ page }) => {
  await page.getByLabel(/When would you like to start\?/u).fill('2025-06-01');
  await page.getByRole('button', { name: 'Complete' }).click();

  await expect(page.getByRole('alert')).toHaveText(
    'Please enter a value no earlier than 2026-01-01.',
  );

  await page.getByLabel(/When would you like to start\?/u).fill('2026-06-01');
  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('status')).toContainText('Thank you');
});

test('parity/C2-comment', async ({ page }) => {
  const feedback = page.getByLabel(/Anything else we should know\?/u);
  await expect(feedback).toHaveRole('textbox');
  await expect(page.getByText('120 characters remaining')).toBeVisible();

  await feedback.fill('Kajay is fine.');
  await expect(page.getByText('106 characters remaining')).toBeVisible();
});

test('parity/C2-comment-auto-grow', async ({ page }) => {
  const feedback = page.getByLabel(/Anything else we should know\?/u);
  const heightOf = async (): Promise<number> =>
    (await feedback.boundingBox())?.height ?? 0;

  const collapsed = await heightOf();
  await feedback.fill('one\ntwo\nthree\nfour\nfive\nsix\nseven');
  expect(await heightOf()).toBeGreaterThan(collapsed);

  // And back down again: measuring rather than counting is what lets it shrink.
  await feedback.fill('one');
  expect(await heightOf()).toBeLessThanOrEqual(collapsed);
});
