import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { Result } from 'axe-core';

/** Copy, paste, duplicate and convert (K5), and deletion (K7), against the real demo. */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

function canvasOf(page: Page): Locator {
  return page.getByRole('region', { name: 'Design surface' }).locator('.kajay-designer');
}

function orderOn(page: Page): Promise<readonly string[]> {
  return canvasOf(page)
    .locator('[data-element-index] .kajay-designer__select')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('aria-label')?.replace('Select ', '') ?? ''),
    );
}

test('parity/K5-duplicate: a question is copied next to itself', async ({ page }) => {
  await page.getByTestId('select-draftTier').click();

  await page.getByTestId('duplicate-draftTier').click();

  expect(await orderOn(page)).toEqual([
    'draftName',
    'draftTier',
    'draftTier2',
    'draftScore',
  ]);
  // The real renderer draws the copy, choices and all — nothing here knows what a radio
  // group is.
  await expect(canvasOf(page).getByRole('radio', { name: 'bronze' })).toHaveCount(2);
});

test('parity/K5-paste: copy on one page, paste on another', async ({ page }) => {
  await page.getByTestId('select-draftName').click();
  await page.getByTestId('copy-draftName').click();

  await page.getByTestId('go-to-p2').click();
  await page.getByTestId('select-draftNotes').click();
  await page.getByTestId('paste-draftNotes').click();

  // The clipboard holds a definition fragment, so it crosses a page change and two
  // re-parses without holding on to anything that stopped existing.
  expect(await orderOn(page)).toEqual(['draftNotes', 'draftName2']);
});

test('parity/K5-convert: a question changes type in place', async ({ page }) => {
  await page.getByTestId('select-draftTier').click();

  await page.getByLabel('Type of draftTier').selectOption('dropdown');

  // Same name, same title, same choices, drawn by the dropdown's renderer.
  await expect(canvasOf(page).getByRole('combobox', { name: /Draft: which tier/u })).toBeVisible();
  await expect(page.getByTestId('surface-json')).toContainText('"type": "dropdown"');
  await expect(page.getByTestId('surface-json')).toContainText('bronze');
});

test('parity/K5-convert: it is undoable like everything else', async ({ page }) => {
  await page.getByTestId('select-draftTier').click();
  await page.getByLabel('Type of draftTier').selectOption('text');
  await expect(page.getByTestId('surface-json')).not.toContainText('bronze');

  await page.getByTestId('undo').click();

  // Nothing in the conversion knows about undo — it goes through `applyEdit`, which is
  // what K6 asked of every editing feature that came after it.
  await expect(page.getByTestId('surface-json')).toContainText('bronze');
});

test('parity/K7-delete: a question goes, and comes back', async ({ page }) => {
  await page.getByTestId('select-draftTier').click();

  await page.getByTestId('delete-draftTier').click();
  expect(await orderOn(page)).toEqual(['draftName', 'draftScore']);
  await expect(page.getByTestId('surface-json')).not.toContainText('bronze');

  await page.getByTestId('undo').click();
  expect(await orderOn(page)).toEqual(['draftName', 'draftTier', 'draftScore']);
});

test('parity/K7-delete: the Delete key removes the selection', async ({ page }) => {
  await page.getByTestId('select-draftName').click();

  await page.keyboard.press('Delete');

  expect(await orderOn(page)).toEqual(['draftTier', 'draftScore']);
  // The neighbour is selected, so the designer is still working where they were.
  await expect(page.getByTestId('surface-selected')).toHaveText('Selected draftTier.');
});

test('parity/K5-actions: the adorner passes the same accessibility bar', async ({ page }) => {
  await page.getByTestId('select-draftTier').click();

  const results = await new AxeBuilder({ page })
    .include('.kajay-designer')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations.map((violation: Result) => violation.id)).toEqual([]);
});
