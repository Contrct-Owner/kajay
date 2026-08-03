import { expect, test } from '@playwright/test';
import { answerRequiredQuestionTypes, gotoQuestionTypes } from './support/navigate.js';

/**
 * The matrix family — checklist §F — in a host that authored it as plain JSON.
 *
 * Its own file because §F adds a type at a time and the §C spec has already been split
 * once for size. The demo's matrix is a ranking spelled as a grid: three subjects, three
 * places, and `eachRowUnique` saying each place may be used once.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await gotoQuestionTypes(page);
});

test('parity/F1-matrix', async ({ page }) => {
  const matrix = page.getByRole('group', { name: /Put these in order/u });
  // Named by its row and its column, so the cell announces the question it is asking
  // rather than its position in a grid.
  await matrix.getByRole('radio', { name: 'Documentation First' }).check();
  await matrix.getByRole('radio', { name: 'Support Second' }).check();

  // One answer, one object keyed by row — not three top-level keys with a prefix. The
  // column *value* is stored, not its label, so the backend gets 1 and the respondent
  // reads "First".
  const data = page.getByTestId('survey-data');
  await expect(data).toContainText('"docs": 1');
  await expect(data).toContainText('"support": 2');
});

test('parity/F1-matrix: a row holds one answer', async ({ page }) => {
  const matrix = page.getByRole('group', { name: /Put these in order/u });
  await matrix.getByRole('radio', { name: 'Documentation First' }).check();
  await matrix.getByRole('radio', { name: 'Documentation Third' }).check();

  await expect(matrix.getByRole('radio', { name: 'Documentation First' })).not.toBeChecked();
  await expect(page.getByTestId('survey-data')).toContainText('"docs": 3');
});

test('parity/F1-each-row-unique', async ({ page }) => {
  await answerRequiredQuestionTypes(page);
  const matrix = page.getByRole('group', { name: /Put these in order/u });
  await matrix.getByRole('radio', { name: 'Documentation First' }).check();
  await matrix.getByRole('radio', { name: 'Support First' }).check();

  await page.getByRole('button', { name: 'Complete' }).click();

  // Against the second row to use the place, and only that one: the first row to use it
  // is not the mistake, and marking it would send the respondent to change an answer
  // they had just made.
  const supportRow = matrix.locator('[data-row-name="support"]');
  await expect(supportRow.getByText('Each row needs a different answer.')).toBeVisible();
  await expect(
    matrix.locator('[data-row-name="docs"]').getByText('Each row needs a different answer.'),
  ).toHaveCount(0);

  await matrix.getByRole('radio', { name: 'Support Second' }).check();
  await page.getByRole('button', { name: 'Complete' }).click();
  // Through the gate, to the preview and then to the end.
  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('status')).toContainText('You answered');
});

test('parity/F1-alternate-rows', async ({ page }) => {
  // A hook in the markup, not a rendering the model performs: the library ships no
  // stylesheet, and the demo's own CSS decides what shading means.
  await expect(page.locator('table.kajay-matrix')).toHaveClass(/kajay-matrix--alternate/u);
});
