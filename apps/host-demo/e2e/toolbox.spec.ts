import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Result } from 'axe-core';

/**
 * The Creator's toolbox against the real demo — checklist K1.
 *
 * What the unit and browser suites cannot show: the panel driven by a host that built
 * the model itself, styled by the stylesheet the library actually ships, in a page it
 * does not own.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('parity/K1-toolbox', async ({ page }) => {
  const toolbox = page.getByRole('region', { name: 'Designer toolbox' });

  // Auto-populated: nothing in the demo lists a type, and every category is here.
  await expect(toolbox.getByRole('heading', { name: 'Text' })).toBeVisible();
  await expect(toolbox.getByRole('heading', { name: 'Panels' })).toBeVisible();
  await expect(toolbox.getByRole('button', { name: 'Repeating panel' })).toBeVisible();

  await toolbox.getByLabel('Search the toolbox').fill('rank');
  await expect(toolbox.getByRole('button', { name: 'Ranking' })).toBeVisible();
  await expect(toolbox.getByRole('button', { name: 'Repeating panel' })).toHaveCount(0);

  await toolbox.getByRole('button', { name: 'Ranking' }).click();
  // The panel reports; the host decides. Where a picked item lands is K2 and K3.
  await expect(page.getByTestId('toolbox-picked')).toHaveText('Picked ranking.');
});

test('parity/K1-toolbox: it is styled by the same tokens as the survey', async ({ page }) => {
  await page.getByLabel('Theme').selectOption('dark');

  // ADR-0022's floor: a host who wants their own *colours* has already got them, and
  // one who wants their own *components* replaces the primitives instead.
  const button = page.getByRole('button', { name: 'Ranking' });
  await expect(button).toHaveCSS('background-color', 'rgb(18, 22, 31)');
});

test('parity/K1-toolbox: it passes the same accessibility bar as the survey', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .include('.kajay-toolbox')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations.map((violation: Result) => violation.id)).toEqual([]);
});
