import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Running the survey being designed, against the real demo — checklist M3.
 *
 * The demo assembles it as a host would: its own section beside the canvas, holding the
 * session so the device and the run survive a re-render. Everything asserted here is
 * reached the way a designer reaches it — type in the preview, or edit on the canvas and
 * watch what the preview does about it.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // A preview is a complete second survey. The demo makes it a tab for that reason, so
  // reaching it is the first thing every scenario here does.
  await page.getByTestId('tab-preview').click();
});

function preview(page: Page): Locator {
  return page.getByRole('region', { name: 'Designer preview' });
}

test('parity/M3-preview: the previewed survey answers, unlike the canvas', async ({ page }) => {
  const panel = preview(page);

  await panel.getByLabel('Draft: applicant name').fill('ada');
  await expect(panel.getByTestId('preview-data')).toContainText('"draftName": "ada"');

  await page.getByTestId('tab-design').click();

  // The canvas is in design mode and refuses every answer; the preview is the real
  // `<Survey>` and takes them. Both look at one definition, and the answer is in neither
  // it nor the document — `data` is the response (E6).
  await expect(page.getByTestId('surface-json')).not.toContainText('ada');
});

test('parity/M3-preview-devices: a preset frames the survey at a real width', async ({ page }) => {
  const panel = preview(page);
  const frame = panel.getByTestId('preview-frame');

  await expect(frame).toHaveJSProperty('style.width', '');

  await panel.getByLabel('Preview device').selectOption('phone');
  await expect(frame).toHaveJSProperty('style.width', '375px');

  await panel.getByTestId('preview-rotate').click();
  await expect(frame).toHaveJSProperty('style.width', '667px');
});

test('parity/M3-preview-follows: an edit is followed until there is something to lose', async ({
  page,
}) => {
  // Nothing answered: the run follows the rename without being asked.
  await page.getByTestId('tab-design').click();
  await page.getByTestId('select-draftName').click();
  await page.getByLabel('Title of draftName').fill('Renamed live');
  await page.getByTestId('tab-preview').click();
  await expect(preview(page).getByLabel('Renamed live')).toBeVisible();
  await expect(preview(page).getByTestId('preview-stale')).toBeHidden();

  // Answered: the run says so, and the answer survived the trip to the other tab — the
  // session is the assembly's, not the tab's.
  await preview(page).getByLabel('Renamed live').fill('ada');
  await page.getByTestId('tab-design').click();
  await page.getByLabel('Title of draftName').fill('Renamed again');
  await page.getByTestId('tab-preview').click();
  await expect(preview(page).getByTestId('preview-stale')).toBeVisible();
  await expect(preview(page).getByLabel('Renamed live')).toHaveValue('ada');

  await preview(page).getByTestId('preview-restart').click();
  await expect(preview(page).getByLabel('Renamed again')).toHaveValue('');
  await expect(preview(page).getByTestId('preview-stale')).toBeHidden();
});

test('parity/M3-preview-data: seeded answers are the premise of a run', async ({ page }) => {
  const panel = preview(page);

  await panel.getByTestId('preview-test-data').fill('{"draftName":"ada"}');
  await panel.getByTestId('preview-seed').click();

  await expect(panel.getByLabel('Draft: applicant name')).toHaveValue('ada');
  await expect(panel.getByTestId('preview-data')).toContainText('"draftName": "ada"');
});

test('parity/M3-preview-data: unparseable JSON is refused rather than seeded', async ({ page }) => {
  const panel = preview(page);

  await panel.getByTestId('preview-test-data').fill('{"draftName":');

  await expect(panel.getByTestId('preview-seed')).toBeDisabled();
  await expect(panel.getByTestId('preview-test-data')).toHaveAttribute('aria-invalid', 'true');
});

test('parity/M3-preview: no accessibility violations', async ({ page }) => {
  const results = await new AxeBuilder({ page }).include('[aria-label="Designer preview"]').analyze();

  expect(results.violations).toEqual([]);
});
