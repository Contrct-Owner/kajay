import { expect, test } from '@playwright/test';
import { gotoQuestionTypes } from './support/navigate.js';

/**
 * A matrix on a phone — checklist F6.
 *
 * Its own file because it is the one spec that needs a different viewport, and a
 * `test.use` in the middle of another file would silently apply to everything after it.
 *
 * The point of running this at 375px rather than asserting a class name is that
 * `mobileMode: auto` resolves against a real media query. A test that only checked for a
 * hook in the markup would pass just as happily if the hook were wired to nothing.
 */
test.use({ viewport: { width: 375, height: 812 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await gotoQuestionTypes(page);
});

test('parity/F6-mobile-mode: a matrix becomes a list of rows', async ({ page }) => {
  const comparison = page.locator('[data-question-name="comparison"]');
  // Not a table: five columns of radio buttons in 375 pixels is a row of unlabelled
  // dots, which is not an answerable question.
  await expect(comparison.locator('table')).toHaveCount(0);

  const row = comparison.getByRole('group', { name: 'Documentation' });
  await row.getByRole('radio', { name: 'First' }).check();

  await expect(page.getByTestId('survey-data')).toContainText('"docs": 1');
});

test('parity/F6-mobile-mode: a table of cells becomes a list too', async ({ page }) => {
  const areas = page.locator('[data-question-name="areas"]');
  await expect(areas.locator('table')).toHaveCount(0);

  // The cell keeps the label it already had — its row and its column — which reads
  // correctly under a legend and behind a column header alike.
  await areas.getByRole('combobox', { name: 'Documentation Rating' }).selectOption('good');
  await expect(page.getByTestId('survey-data')).toContainText('"rating": "good"');
});
