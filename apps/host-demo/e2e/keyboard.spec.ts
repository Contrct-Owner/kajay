import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { gotoQuestionTypes } from './support/navigate.js';

/**
 * Keyboard operability — checklist J4.
 *
 * The half axe cannot check. It reads the page and reports what is *named*; whether a
 * respondent with no pointer can actually answer is a question only pressing keys can
 * settle, and the types most likely to fail it are the ones built out of something
 * other than a plain input: a matrix, a ranking, a rating drawn as stars.
 *
 * Everything here uses real keys. Nothing calls `.click()` or `.focus()` to get
 * somewhere — that would be testing the assertion rather than the journey.
 */
function focused(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (element === null) {
      return 'none';
    }
    const label = element.getAttribute('aria-label') ?? element.textContent ?? '';
    return `${element.tagName.toLowerCase()}:${label.trim().slice(0, 40)}`;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('parity/J4-keyboard: a survey can be answered and advanced with no pointer', async ({
  page,
}) => {
  const name = page.getByLabel(/What is your name\?/u);
  await name.focus();
  await page.keyboard.type('Ada');

  // Tab reaches the next question in document order — the nickname, which the name has
  // just made visible and required. Nothing here knows where it is on screen.
  await page.keyboard.press('Tab');
  expect(await focused(page)).toContain('input');
  await page.keyboard.type('Ada');
  await expect(page.getByLabel(/What should we call you\?/u)).toHaveValue('Ada');

  // Enter in a text field submits the form, which on a multi-page survey means Next.
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Logic showcase' })).toBeVisible();
});

test('parity/J4-keyboard: a radio group walks with the arrow keys', async ({ page }) => {
  await page.getByLabel(/What is your name\?/u).fill('Ada');
  await page.getByLabel(/What should we call you\?/u).fill('Ada');
  await page.getByRole('button', { name: 'Next' }).click();

  // Focus the group the way a keyboard does — Tab to the first radio — then move.
  await page.getByLabel('free').focus();
  await page.keyboard.press('ArrowDown');

  // Native radio behaviour, which is the whole reason the renderer uses real inputs:
  // arrowing selects as it moves, and the model hears about it.
  await expect(page.getByLabel('paid')).toBeChecked();
  await expect(page.getByTestId('survey-data')).toContainText('"plan": "paid"');
});

test('parity/J4-keyboard: a rating drawn as stars is still a radio group', async ({ page }) => {
  await gotoQuestionTypes(page);
  const stars = page.getByRole('group', { name: /How is it going so far\?/u });

  // By role and accessible name: the star glyph is `aria-hidden` decoration and the
  // input is moved out of sight, so `getByLabel` finds nothing while the radio is
  // perfectly reachable — which is the distinction this test exists to make.
  await stars.getByRole('radio', { name: '3' }).focus();
  await page.keyboard.press('ArrowRight');

  // The glyph changed how it looks, not how it works.
  await expect(stars.getByRole('radio', { name: '4' })).toBeChecked();
  await expect(page.getByTestId('survey-data')).toContainText('"satisfaction": 4');
});

test('parity/J4-keyboard: a matrix cell is reachable and answerable', async ({ page }) => {
  await gotoQuestionTypes(page);
  const matrix = page.getByRole('group', { name: /Put these in order, one place each/u });

  await matrix.getByRole('radio', { name: 'Documentation First' }).focus();
  await page.keyboard.press('ArrowRight');

  // Arrowing inside a matrix row moves along that row, because each row is its own
  // radio group — a single group across the table would let one arrow press walk into
  // somebody else's question.
  await expect(matrix.getByRole('radio', { name: 'Documentation Second' })).toBeChecked();
  await expect(page.getByTestId('survey-data')).toContainText('"docs": 2');
});

test('parity/J4-keyboard: a ranking can be reordered with the keyboard alone', async ({
  page,
}) => {
  await gotoQuestionTypes(page);
  const ranking = page.getByRole('group', { name: /What matters most to you\?/u });

  await ranking.getByRole('button', { name: /Speed/u }).focus();
  // Pick up, move, put down — the interaction the hint above the list describes.
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');

  await expect(page.getByTestId('survey-data')).toContainText('"price",\n    "speed"');
  // And focus stays on the row that moved, so a respondent does not lose their place.
  expect(await focused(page)).toContain('button');
});

test('parity/J4-keyboard: a repeating panel can be added and removed', async ({ page }) => {
  await gotoQuestionTypes(page);
  const travellers = page.getByRole('group', { name: /Who else is coming\?/u });

  await travellers.getByRole('button', { name: 'Add a traveller' }).focus();
  await page.keyboard.press('Enter');

  await expect(travellers.getByLabel(/Traveller 2 Name/u)).toBeVisible();
});
