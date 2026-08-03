import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { Result } from 'axe-core';

/**
 * Page management against the real demo — checklist K4.
 *
 * The pointer half of page reordering lives here for K2's reason: `setPointerCapture`
 * needs a live pointer, and a synthesised `pointerdown` has none.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

function navigatorOf(page: Page): Locator {
  return page.getByRole('region', { name: 'Design surface' }).locator('.kajay-pages');
}

function pageOrder(page: Page): Promise<readonly string[]> {
  return navigatorOf(page)
    .locator('.kajay-pages__go')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ''));
}

async function pointIn(locator: Locator, at = 0.5): Promise<{ x: number; y: number }> {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width * at, y: box.y + box.height / 2 };
}

test('parity/K4-navigate: the canvas follows the page list', async ({ page }) => {
  const surface = page.getByRole('region', { name: 'Design surface' });

  await page.getByTestId('go-to-p2').click();

  // The second page's question, drawn by the real renderer — the canvas is the same
  // WYSIWYG surface K3 built, pointed at a different page.
  await expect(surface.getByLabel('Draft: notes')).toBeVisible();
  await expect(surface.getByLabel('Draft: applicant name')).toBeHidden();
});

test('parity/K4-add-page: a new page arrives empty and open', async ({ page }) => {
  await page.getByTestId('add-page').click();

  expect(await pageOrder(page)).toEqual(['Draft: the first page', 'p2', 'page1']);
  await expect(page.getByTestId('go-to-page1')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('surface-json')).toContainText('page1');
});

test('parity/K4-remove-page: the page and its questions go together', async ({ page }) => {
  await page.getByTestId('remove-p2').click();

  expect(await pageOrder(page)).toEqual(['Draft: the first page']);
  await expect(page.getByTestId('surface-json')).not.toContainText('draftNotes');
});

test('parity/K4-reorder-pages: a page is dragged by its handle', async ({ page }) => {
  const handle = page.getByTestId('move-page-p1');
  const target = navigatorOf(page).locator('[data-element-index="1"]');

  const start = await pointIn(handle);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 4, start.y + 4);
  const end = await pointIn(target, 0.9);
  await page.mouse.move(end.x, end.y, { steps: 8 });

  // Dropped past the last page, so the indicator is the end-of-list marker rather than
  // a line above something. And it is on the page list: one placement drives two lists,
  // so a slot that did not name its own would light up the canvas as well.
  await expect(page.getByTestId('page-drop-at-end')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Design surface' }).locator('.kajay-designer [data-drop-before]'),
  ).toHaveCount(0);

  await page.mouse.up();
  expect(await pageOrder(page)).toEqual(['p2', 'Draft: the first page']);
});

test('parity/K4-page-adorner: a page is renamed from the canvas', async ({ page }) => {
  await page.getByTestId('select-page-p1').click();

  await page.getByLabel('Title of page p1').fill('Before we begin');

  // The heading on the canvas and the entry in the list are the same title, so the
  // rename shows in both — and it is the definition that changed.
  await expect(page.getByTestId('go-to-p1')).toHaveText('Before we begin');
  await expect(page.getByTestId('surface-json')).toContainText('Before we begin');
});

test('parity/K4-pages: the navigator passes the same accessibility bar', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .include('.kajay-pages')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations.map((violation: Result) => violation.id)).toEqual([]);
});
