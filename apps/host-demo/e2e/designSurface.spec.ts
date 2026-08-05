import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Result } from 'axe-core';

/**
 * The design surface against the real demo — checklist K3.
 *
 * What the browser suite cannot show: real questions drawn by the real renderers,
 * styled by the stylesheet the library ships, edited by a host that owns the model.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('parity/K3-design-surface', async ({ page }) => {
  const surface = page.getByRole('region', { name: 'Design surface' });

  // Real questions, drawn by the respondent's renderers. Nothing in the Creator knows
  // what a rating is.
  await expect(surface.getByLabel('Draft: applicant name')).toBeVisible();
  await expect(surface.getByRole('radio', { name: 'bronze' })).toBeVisible();
  await expect(surface.getByRole('group', { name: /Draft: how likely to recommend\?/u })).toBeVisible();
});

test('parity/K3-selection', async ({ page }) => {
  const surface = page.getByRole('region', { name: 'Design surface' });

  await surface.getByRole('radio', { name: 'silver' }).click();

  // A click selects rather than answers, and the radio does not move under the pointer.
  await expect(page.getByTestId('surface-selected')).toHaveText('Selected draftTier.');
  await expect(surface.getByRole('radio', { name: 'silver' })).not.toBeChecked();
});

test('parity/K3-inline-title', async ({ page }) => {
  const surface = page.getByRole('region', { name: 'Design surface' });
  await surface.getByRole('button', { name: 'Select draftName' }).click();

  await surface.getByLabel('Title of draftName').fill('What is your full name?');
  // P10 commits on blur; Enter is how a designer says they are done.
  await page.keyboard.press('Enter');

  // The rendered question updates live, and the definition the host would save with it.
  await expect(surface.getByLabel('What is your full name?')).toBeVisible();
  await expect(page.getByTestId('surface-json')).toContainText('What is your full name?');
});

test('parity/K3-design-surface: it passes the same accessibility bar as the survey', async ({
  page,
}) => {
  const results = await new AxeBuilder({ page })
    .include('.kajay-designer')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations.map((violation: Result) => violation.id)).toEqual([]);
});
