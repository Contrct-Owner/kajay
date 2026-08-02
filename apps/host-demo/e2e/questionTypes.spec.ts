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

test('parity/C7-boolean-switch', async ({ page }) => {
  const updates = page.getByLabel('Email me when something ships');
  await expect(updates).not.toBeChecked();
  // Unanswered, not false: nothing is in `data` yet.
  await expect(page.getByTestId('survey-data')).not.toContainText('wantsUpdates');

  await updates.check();
  await expect(page.getByTestId('survey-data')).toContainText('"wantsUpdates": true');
});

test('parity/C7-boolean-radio-with-custom-values', async ({ page }) => {
  await page.getByLabel('Not yet', { exact: true }).check();
  // What the backend asked for, not a boolean.
  await expect(page.getByTestId('survey-data')).toContainText('"hasBudget": "pending"');

  await page.getByLabel('Approved').check();
  await expect(page.getByTestId('survey-data')).toContainText('"hasBudget": "approved"');
});

test('parity/C8-rating-stars', async ({ page }) => {
  const stars = page.getByRole('group', { name: /How is it going so far\?/u });
  // Real radios under the stars, reachable by name — the star itself is `aria-hidden`
  // decoration, so the scale announces "4" rather than "star star star star".
  await expect(stars.getByRole('radio', { name: '4' })).toBeAttached();

  // Clicked through the label, which is what a pointer actually lands on: the input is
  // moved out of sight so it keeps its keyboard behaviour and its focus ring.
  const star = (position: number) => stars.locator(`label:has(input[value="${String(position)}"])`);
  await star(4).click();
  await expect(page.getByTestId('survey-data')).toContainText('"satisfaction": 4');
  await expect(stars.getByRole('radio', { name: '4' })).toBeChecked();

  // Picking it again takes the answer back, which is the only way out of a radio group.
  await star(4).click();
  await expect(page.getByTestId('survey-data')).not.toContainText('satisfaction');
});

test('parity/C8-rating-auto-collapses-a-long-scale', async ({ page }) => {
  // Eleven steps and no `displayMode` in the definition: the model decided. The
  // collapsed form is a labelled control rather than a group, so the select has a name
  // of its own — a legend names a fieldset and nothing inside it.
  const recommend = page.getByLabel(/How likely are you to recommend Kajay\?/u);
  await expect(recommend).toHaveRole('combobox');
  await expect(recommend.locator('option')).toHaveCount(12);

  // Scoped to the question: the demo also prints the canonical JSON, where the same
  // string appears as the property that produced it.
  await expect(
    page.locator('[data-question-name="recommend"]').getByText('Not at all likely'),
  ).toBeVisible();
  await recommend.selectOption('9');
  await expect(page.getByTestId('survey-data')).toContainText('"recommend": 9');
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
