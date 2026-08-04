import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** Undo and redo against the real demo — checklist K6. */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

function canvasOf(page: Page): Locator {
  return page.getByRole('region', { name: 'Design surface' }).locator('.kajay-designer');
}

/**
 * The elements at the top level of a container, in order.
 *
 * Scoped by container, because the canvas is a tree now: `[data-element-index]` matches
 * a question inside a panel exactly as it matches one on the page, and an unscoped
 * version quietly started reporting the whole survey flattened.
 */
function orderIn(page: Page, container = 'p1'): Promise<readonly string[]> {
  return canvasOf(page)
    .locator(`[data-in-container="${container}"] > .kajay-designer__adorner > .kajay-designer__bar > .kajay-designer__select`)
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('aria-label')?.replace('Select ', '') ?? ''),
    );
}

test('parity/K6-undo: a dropped question is taken back, and put back', async ({ page }) => {
  await expect(page.getByTestId('undo')).toBeDisabled();

  await page.getByTestId('toolbox-comment').click();
  expect(await orderIn(page)).toContain('comment1');

  await page.getByTestId('undo').click();
  // The definition the host would save is what changed back, not just the screen.
  expect(await orderIn(page)).toEqual(['draftName', 'draftTier', 'draftScore', 'draftGroup', 'draftEmpty']);
  await expect(page.getByTestId('surface-json')).not.toContainText('comment1');

  await page.getByTestId('redo').click();
  await expect(page.getByTestId('surface-json')).toContainText('comment1');
});

test('parity/K6-undo: a deleted page comes back with its questions', async ({ page }) => {
  await page.getByTestId('remove-p2').click();
  await expect(page.getByTestId('surface-json')).not.toContainText('draftNotes');

  await page.getByTestId('undo').click();

  // Undo is a re-parse of a whole definition, so this costs nothing extra: there is no
  // inverse of "delete a page" for anybody to have written incorrectly.
  await expect(page.getByTestId('surface-json')).toContainText('draftNotes');
  await expect(page.getByTestId('go-to-p2')).toBeVisible();
});

test('parity/K6-undo: renaming is one undo, not one per keystroke', async ({ page }) => {
  await page.getByTestId('select-draftName').click();
  await page.getByLabel('Title of draftName').fill('What is your full name?');

  await page.getByTestId('undo').click();

  // `fill` types the whole string; each character is a separate `setTitle`. They
  // coalesce, so one press gives back the original rather than one letter.
  await expect(page.getByTestId('surface-json')).toContainText('Draft: applicant name');
  await expect(page.getByTestId('undo')).toBeDisabled();
});

test('parity/K6-undo: it puts the designer back where the edit happened', async ({ page }) => {
  await page.getByTestId('go-to-p2').click();
  await page.getByTestId('toolbox-comment').click();
  await page.getByTestId('go-to-p1').click();

  await page.getByTestId('undo').click();

  // Restoring the survey alone would be correct and disorienting — the change would
  // happen on a page nobody could see.
  await expect(page.getByTestId('go-to-p2')).toHaveAttribute('aria-current', 'page');
});

test('parity/K6-shortcut: Ctrl+Z works inside the canvas', async ({ page }) => {
  await page.getByTestId('toolbox-comment').click();

  await page.getByTestId('select-draftName').click();
  await page.keyboard.press('Control+z');

  expect(await orderIn(page)).toEqual(['draftName', 'draftTier', 'draftScore', 'draftGroup', 'draftEmpty']);
});
