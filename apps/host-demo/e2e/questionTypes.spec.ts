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

test('parity/C11-multipletext', async ({ page }) => {
  const workplace = page.getByRole('group', { name: /Where do you work\?/u });
  await workplace.getByLabel('Street').fill('12 Long Road');
  await workplace.getByLabel('City').fill('Cambridge');

  // One answer, one object — not three top-level keys with a shared prefix.
  await expect(page.getByTestId('survey-data')).toContainText('"street": "12 Long Road"');
  await expect(page.getByTestId('survey-data')).toContainText('"workplace"');
});

test('parity/C11-multipletext-per-item-validation', async ({ page }) => {
  const workplace = page.getByRole('group', { name: /Where do you work\?/u });
  await workplace.getByLabel('Postcode').fill('nope');
  await page.getByRole('button', { name: 'Complete' }).click();

  // Each message sits beside the field that earned it, and only that field is marked.
  await expect(workplace.getByLabel('Street')).toHaveAttribute('aria-invalid', 'true');
  await expect(workplace.getByLabel('City')).not.toHaveAttribute('aria-invalid', 'true');
  // Scoped to the question: the demo also prints the canonical JSON, which contains the
  // authored message.
  await expect(workplace.getByText('Five digits, please.')).toBeVisible();

  await workplace.getByLabel('Street').fill('12 Long Road');
  await workplace.getByLabel('Postcode').fill('12345');
  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('status')).toContainText('Thank you');
});

test('parity/C10-imagepicker', async ({ page }) => {
  const palette = page.getByRole('group', { name: /Pick the colours you like/u });
  // Real checkboxes under the tiles — `multiSelect` decides the control's type, so
  // "pick several" sounds different to a screen reader as well as behaving differently.
  await expect(palette.getByRole('checkbox', { name: 'Blue' })).toBeAttached();

  const tile = (name: string) => palette.locator(`label:has(input[value="${name}"])`);
  await tile('blue').click();
  await tile('amber').click();
  await expect(page.getByTestId('survey-data')).toContainText('"blue"');
  await expect(page.getByTestId('survey-data')).toContainText('"amber"');

  // The picture is decorative: the choice text is the tile's name, so the image adds
  // nothing a screen reader has not already been told.
  await expect(palette.locator('img').first()).toHaveAttribute('alt', '');
});

test('parity/C12-html-and-image', async ({ page }) => {
  // Rendered as markup, not escaped: the `<strong>` is an element, not four characters.
  await expect(page.locator('[data-element-name="intro"] strong')).toHaveText(
    'Nothing here is required.',
  );

  const logo = page.getByAltText('The Kajay wordmark');
  await expect(logo).toBeVisible();
  // Sized through CSS rather than the `width` attribute, so `imageFit` has a box to
  // fit into and the theme's `max-width: 100%` can still shrink it on a narrow screen.
  expect((await logo.boundingBox())?.width).toBe(120);

  // Neither holds an answer, so neither is in the result.
  const data = page.getByTestId('survey-data');
  await expect(data).not.toContainText('intro');
  await expect(data).not.toContainText('logo');
});

test('parity/C12-expression-question', async ({ page }) => {
  const annual = page.getByLabel('Estimated annual cost');
  // Hidden until there is something to compute, by its own `visibleIf`.
  await expect(annual).toHaveCount(0);

  await page.getByLabel(/How many people on your team\?/u).fill('3');
  await page.getByRole('button', { name: 'Previous' }).click();
  await page.getByLabel('paid').check();
  await page.getByLabel('Monthly price').fill('10');
  await page.getByRole('button', { name: 'Next' }).click();

  // Computed across two pages, formatted for display, and stored as a plain number.
  await expect(page.getByLabel('Estimated annual cost')).toHaveText('$360.00');
  await expect(page.getByTestId('survey-data')).toContainText('"annualCost": 360');
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
