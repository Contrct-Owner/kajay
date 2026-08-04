import { expect, test } from '@playwright/test';

test('the custom host layout keeps every tab on one workspace in StrictMode', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('select-draftName').click();
  await page.getByLabel('Title of draftName').fill('One workspace title');

  await page.getByTestId('tab-json').click();
  await expect(
    page.getByRole('region', { name: 'Designer JSON' }).getByLabel('Survey definition'),
  ).toHaveValue(/One workspace title/u);

  await page.getByTestId('tab-translations').click();
  await expect(
    page
      .getByRole('region', { name: 'Designer translations' })
      .getByTestId('translation-cell-survey/pages/p1/elements/draftName/title-default'),
  ).toHaveValue('One workspace title');

  await page.getByTestId('tab-preview').click();
  await expect(
    page.getByRole('region', { name: 'Designer preview' }).getByLabel('One workspace title'),
  ).toBeVisible();
});
