import { expect, test } from '@playwright/test';

test('the preview documentation shell is server-rendered and navigable', async ({ page }) => {
  const response = await page.goto('/docs');
  const html = (await response?.text()) ?? '';

  expect(html).toContain('Kajay documentation');
  await expect(page.getByText('Preview', { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Documentation' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'On this page' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kajay documentation' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('the landing page exposes Docs in primary navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Docs' }).click();

  await expect(page).toHaveURL(/\/docs$/u);
  await expect(page.getByRole('heading', { name: 'Kajay documentation' })).toBeVisible();
});

test('documentation navigation remains available on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/docs');

  const disclosure = page.getByText('Browse documentation', { exact: true });
  await expect(disclosure).toBeVisible();
  await disclosure.click();
  await expect(page.getByRole('navigation', { name: 'Mobile documentation' })).toBeVisible();
});
