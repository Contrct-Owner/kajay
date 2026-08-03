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

test('parity/F2-matrix-cells', async ({ page }) => {
  const areas = page.getByRole('group', { name: /How are we doing in each area/u });
  // A real dropdown, drawn by the renderer registered for `dropdown` — the column said
  // `type`, and the cell is a question of that type like any other.
  await areas.getByRole('combobox', { name: 'Documentation Rating' }).selectOption('poor');

  // One answer, an object of objects keyed by row and then column.
  await expect(page.getByTestId('survey-data')).toContainText('"rating": "poor"');

  // The comment appears in the row that asked for it, and only there: the column's
  // `{row.rating}` was rewritten into a real path when the cell was built.
  await expect(areas.getByRole('textbox', { name: 'Documentation What went wrong?' })).toBeVisible();
  await expect(areas.getByRole('textbox', { name: 'Support What went wrong?' })).toHaveCount(0);
});

test('parity/F3-matrix-dynamic', async ({ page }) => {
  const expenses = page.getByRole('group', { name: /Anything to expense/u });
  await expenses.getByRole('spinbutton', { name: 'Line 1 Quantity' }).fill('2');
  await expenses.getByRole('spinbutton', { name: 'Line 1 Unit price' }).fill('21.25');
  await expenses.getByRole('button', { name: 'Add a line' }).click();
  await expenses.getByRole('spinbutton', { name: 'Line 2 Quantity' }).fill('1');
  await expenses.getByRole('spinbutton', { name: 'Line 2 Unit price' }).fill('7.5');

  // The rows *are* the answer, so the count needs nothing stored beside them.
  await expect(page.getByTestId('survey-data')).toContainText('"quantity": 2');
  await expect(expenses.locator('[data-total-for="amount"]')).toHaveText('50.00');

  // Removing asks first, in the page rather than in a native dialog.
  await expenses.getByRole('button', { name: 'Remove' }).first().click();
  await expenses.getByRole('button', { name: 'Remove this row?' }).click();

  await expect(expenses.getByRole('spinbutton', { name: 'Line 1 Unit price' })).toHaveValue('7.5');
  await expect(expenses.locator('[data-total-for="amount"]')).toHaveText('7.50');
});

test('parity/F5-row-and-total-expressions', async ({ page }) => {
  const expenses = page.getByRole('group', { name: /Anything to expense/u });
  await expenses.getByRole('spinbutton', { name: 'Line 1 Quantity' }).fill('3');
  await expenses.getByRole('spinbutton', { name: 'Line 1 Unit price' }).fill('4');

  // Computed from its own row, and stored as a real answer rather than drawn.
  await expect(expenses.getByLabel('Line 1 Amount')).toHaveText('12');
  await expect(page.getByTestId('survey-data')).toContainText('"amount": 12');

  await expenses.getByRole('button', { name: 'Add a line' }).click();
  await expenses.getByRole('spinbutton', { name: 'Line 2 Quantity' }).fill('1');
  await expenses.getByRole('spinbutton', { name: 'Line 2 Unit price' }).fill('8');

  // 20 over 4 items: the unit total is an expression over the *other* totals.
  await expect(expenses.locator('[data-total-for="amount"]')).toHaveText('20.00');
  await expect(expenses.locator('[data-total-for="unit"]')).toHaveText('5.00');
});

test('parity/F4-detail-panels', async ({ page }) => {
  const expenses = page.getByRole('group', { name: /Anything to expense/u });
  const toggle = expenses.getByRole('button', { name: 'Line 1' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await toggle.click();
  await expenses.getByRole('textbox', { name: 'Line 1 What was it for?' }).fill('Train fare');

  // Into the row it belongs to, beside the columns: a detail is a cell drawn somewhere
  // else, not a second kind of answer.
  await expect(page.getByTestId('survey-data')).toContainText('"what": "Train fare"');
});

test('parity/F1-alternate-rows', async ({ page }) => {
  // A hook in the markup, not a rendering the model performs: the library ships no
  // stylesheet, and the demo's own CSS decides what shading means.
  await expect(
    page.locator('[data-question-name="comparison"] table.kajay-matrix'),
  ).toHaveClass(/kajay-matrix--alternate/u);
});
