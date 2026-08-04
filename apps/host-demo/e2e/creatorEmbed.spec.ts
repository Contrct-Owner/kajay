import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * The whole Creator as one component — checklist N1.
 *
 * The demo holds the definition in its own state and echoes every change straight back,
 * which is what "controlled" means to a host and the thing this row has to survive.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('toggle-embed').click();
});

function embed(page: Page): Locator {
  return page.getByRole('region', { name: 'Embedded creator' });
}

test('parity/N1-assembly: the assembly is built from the pieces, and shows one tab', async ({
  page,
}) => {
  await expect(embed(page).getByTestId('select-embedName')).toBeVisible();
  await expect(embed(page).getByTestId('creator-tab-design')).toHaveAttribute(
    'aria-current',
    'page',
  );

  await embed(page).getByTestId('creator-tab-preview').click();
  await expect(embed(page).getByTestId('preview-frame')).toBeVisible();
  await expect(embed(page).getByTestId('select-embedName')).toBeHidden();
});

test('parity/N1-controlled: an edit comes out and the echo does not come back in', async ({
  page,
}) => {
  await embed(page).getByTestId('select-embedName').click();
  await embed(page).getByLabel('Title of embedName').fill('Renamed by the host');

  // The host set its state from `onChange` and passed it straight back. If the Creator
  // treated its own output as an incoming document it would have re-opened itself, losing
  // the selection and the field being typed in.
  await expect(embed(page).getByLabel('Title of embedName')).toHaveValue('Renamed by the host');
  await expect(embed(page).getByTestId('embed-value')).toContainText('Renamed by the host');
});

test('parity/N1-save: auto-save reports success, and a refusal is said', async ({ page }) => {
  await embed(page).getByTestId('select-embedName').click();
  await embed(page).getByLabel('Title of embedName').fill('Fine');

  await expect(embed(page).getByTestId('creator-save-state')).toHaveAttribute(
    'data-state',
    'saved',
  );
  await expect(embed(page).getByTestId('embed-saves')).not.toContainText('attempted: 0');

  // The demo's pretend backend refuses a title containing this, so the failure path is on
  // screen rather than only in a unit test.
  await embed(page).getByLabel('Title of embedName').fill('refuse-this-save');

  await expect(embed(page).getByTestId('creator-save-state')).toHaveAttribute(
    'data-state',
    'failed',
  );
  await expect(embed(page).getByTestId('creator-save-state')).toContainText('Save failed');
});

test('parity/N1-assembly: no accessibility violations', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .include('[aria-label="Embedded creator"]')
    .analyze();

  expect(results.violations).toEqual([]);
});
