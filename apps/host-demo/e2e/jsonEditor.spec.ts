import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * The definition as text, against the real demo — checklist M2.
 *
 * A tab like the preview, and for a smaller version of the same reason: a textarea holding
 * a whole survey is not something to put beside the canvas. Everything asserted here goes
 * through the tab, because that is how a designer reaches it.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('tab-json').click();
});

function json(page: Page): Locator {
  return page.getByRole('region', { name: 'Designer JSON' });
}

test('parity/M2-json-sync: it opens on the designer’s own definition', async ({ page }) => {
  await expect(json(page).getByLabel('Survey definition')).toHaveValue(/"name": "draftName"/u);
  await expect(json(page).getByTestId('json-apply')).toBeDisabled();
});

test('parity/M2-json-sync: an edit here reaches the canvas, and is undoable', async ({ page }) => {
  await json(page)
    .getByLabel('Survey definition')
    .fill('{"pages":[{"name":"p1","elements":[{"type":"comment","name":"handWritten","title":"Typed by hand"}]}]}');
  await json(page).getByTestId('json-apply').click();

  await page.getByTestId('tab-design').click();
  await expect(page.getByTestId('select-handWritten')).toBeVisible();

  // Hand-editing the whole survey in a keystroke is exactly where undo matters most, and
  // it costs nothing — `applyEdit` is the same seam a drag goes through.
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('select-draftName')).toBeVisible();
});

test('parity/M2-json-sync: a canvas edit reaches the text', async ({ page }) => {
  await page.getByTestId('tab-design').click();
  await page.getByTestId('select-draftName').click();
  await page.getByLabel('Title of draftName').fill('Renamed on the canvas');

  await page.getByTestId('tab-json').click();
  await expect(json(page).getByLabel('Survey definition')).toHaveValue(
    /Renamed on the canvas/u,
  );
});

test('parity/M2-json-errors: a syntax error is surfaced and blocks applying', async ({ page }) => {
  await json(page).getByLabel('Survey definition').fill('{\n"pages":[]\n"x":1\n}');

  await expect(json(page).getByTestId('json-problem')).toContainText('Line 3, column 1');
  await expect(json(page).getByLabel('Survey definition')).toHaveAttribute('aria-invalid', 'true');
  await expect(json(page).getByTestId('json-apply')).toBeDisabled();
});

test('parity/M2-json-errors: a diagnostic is surfaced and does not block', async ({ page }) => {
  await json(page)
    .getByLabel('Survey definition')
    .fill('{"pages":[{"name":"p1","elements":[{"type":"text","name":"who","nonsense":1}]}]}');

  await expect(json(page).getByTestId('json-diagnostics')).toContainText('/pages/0/elements/0');
  await expect(json(page).getByTestId('json-apply')).toBeEnabled();
});

test('parity/M2-json-sync: the draft survives a trip to another tab', async ({ page }) => {
  await json(page).getByLabel('Survey definition').fill('{"pages":[]}');

  await page.getByTestId('tab-design').click();
  await page.getByTestId('tab-json').click();

  // The session is the assembly's, not the tab's — the same decision M3 made.
  await expect(json(page).getByLabel('Survey definition')).toHaveValue('{"pages":[]}');
});

test('parity/M2-json: no accessibility violations', async ({ page }) => {
  const results = await new AxeBuilder({ page }).include('[aria-label="Designer JSON"]').analyze();

  expect(results.violations).toEqual([]);
});
