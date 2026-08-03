import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { Result } from 'axe-core';

/**
 * The property grid against the real demo — checklist L1.
 *
 * The demo assembles it as a host would: its own section, beside the canvas rather than
 * inside it, holding nothing of its own. Everything asserted here is reached the way a
 * designer reaches it — select something, then edit a labelled field.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

function grid(page: Page): Locator {
  return page.getByRole('region', { name: 'Designer properties' });
}

function field(page: Page, label: string): Locator {
  return grid(page).getByLabel(label, { exact: true });
}

test('parity/L1-grid: the sections appear when something is selected', async ({ page }) => {
  await expect(grid(page).getByText('Select a question or a page to edit it.')).toBeVisible();

  await page.getByTestId('select-draftName').click();

  // Generated: a text question's own `inputType` beside the `name` every element has,
  // with neither of them named anywhere in the Creator.
  await expect(field(page, 'Input type')).toHaveValue('text');
  await expect(field(page, 'Name')).toHaveValue('draftName');
  await expect(grid(page).getByTestId('properties-Logic')).toBeVisible();
});

test('parity/L1-editors: an edit reaches the definition a host would save', async ({ page }) => {
  await page.getByTestId('select-draftName').click();

  await field(page, 'Is required').check();
  await field(page, 'Placeholder').fill('Family name first');

  await expect(page.getByTestId('surface-json')).toContainText('"isRequired": true');
  await expect(page.getByTestId('surface-json')).toContainText('Family name first');
  // The canvas is the real renderer, so the question a respondent will answer changes
  // under the designer as they type — which is what makes the grid WYSIWYG too.
  const canvas = page.getByRole('region', { name: 'Design surface' });
  await expect(canvas.getByLabel(/Draft: applicant name/u)).toHaveAttribute(
    'placeholder',
    'Family name first',
  );
});

test('parity/L1-rename: a reference follows the name', async ({ page }) => {
  await page.getByTestId('select-draftName').click();

  await field(page, 'Name').fill('applicant');
  // Committed on blur, because a rename rewrites every reference and doing that per
  // keystroke would take `{draftName}` through a series of names nothing ever had.
  await field(page, 'Title').click();

  await expect(page.getByTestId('surface-json')).toContainText('"{applicant} notempty"');
  await expect(page.getByTestId('surface-json')).not.toContainText('draftName');
  await expect(page.getByTestId('surface-selected')).toHaveText('Selected applicant.');
});

test('parity/L1-rename: a name already taken is refused', async ({ page }) => {
  await page.getByTestId('select-draftName').click();

  await field(page, 'Name').fill('draftTier');
  await field(page, 'Title').click();

  await expect(field(page, 'Name')).toHaveValue('draftName');
  await expect(page.getByTestId('surface-json')).toContainText('"{draftName} notempty"');
});

test('parity/L1-grid: an edit is one undo, not one per keystroke', async ({ page }) => {
  await page.getByTestId('select-draftName').click();

  await field(page, 'Placeholder').fill('Family name');
  await page.getByTestId('undo').click();

  await expect(page.getByTestId('surface-json')).not.toContainText('Family name');
  await expect(field(page, 'Placeholder')).toHaveValue('');
});

test('parity/L1-grid: a page has a grid of its own', async ({ page }) => {
  await page.getByTestId('select-page-p1').click();

  // K4 made the page selectable and this row needed no code about pages: it is a
  // registered class, so its properties are generated like anything else's.
  await expect(field(page, 'Name')).toHaveValue('p1');
  await expect(field(page, 'Col count')).toHaveValue('2');
});

test('parity/L1-grid: no accessibility violations', async ({ page }) => {
  await page.getByTestId('select-draftName').click();

  const results = await new AxeBuilder({ page })
    .include('.kajay-properties')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations.map((violation: Result) => violation.id)).toEqual([]);
});
