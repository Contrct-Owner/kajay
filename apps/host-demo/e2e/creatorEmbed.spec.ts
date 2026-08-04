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

test('parity/N1-primitives: host controls preserve editing and focus behavior', async ({
  page,
}) => {
  await embed(page).getByTestId('select-embedName').click();

  const title = embed(page).getByLabel('Title of embedName');
  await expect(title).toHaveAttribute('data-host-primitive', 'input');
  await title.fill('Drawn by the host');
  await expect(title).toBeFocused();

  const type = embed(page).getByLabel('Type of embedName');
  await expect(type).toHaveAttribute('data-host-primitive', 'select');
  await type.selectOption('comment');
  await expect(type).toHaveValue('comment');

  await embed(page).getByTestId('creator-tab-json').click();
  const definition = embed(page).getByLabel('Survey definition');
  await expect(definition).toHaveAttribute('data-host-primitive', 'textarea');
  await definition.fill('{');
  await expect(definition).toBeFocused();
  await expect(definition).toHaveAttribute('aria-invalid', 'true');
  await expect(embed(page).getByTestId('json-apply')).toBeDisabled();
  await expect(embed(page).getByTestId('json-revert')).toBeEnabled();
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

test('parity/N2-config: a restricted deployment is the same component, told less', async ({
  page,
}) => {
  await page.getByTestId('toggle-restricted').check();

  // Three question types, two tabs, and the logic rows gone from the grid — all from one
  // plain value that could as easily have come from a server.
  await expect(embed(page).getByTestId('toolbox-text')).toBeVisible();
  await expect(embed(page).getByTestId('toolbox-file')).toBeHidden();
  await expect(embed(page).getByTestId('creator-tab-json')).toBeHidden();
  await expect(embed(page).getByTestId('creator-tab-preview')).toBeVisible();

  await embed(page).getByTestId('select-embedName').click();
  // Property ids carry their element's scope (L1), or one question's `visibleIf` and the
  // `visibleIf` of a choice inside it would be one field with two labels.
  await expect(embed(page).getByTestId('property-embedName-visibleIf')).toBeHidden();
  await expect(embed(page).getByTestId('property-embedName-title')).toBeVisible();
});

test('parity/N2-config: turning the restriction off gives everything back', async ({ page }) => {
  await page.getByTestId('toggle-restricted').check();
  await expect(embed(page).getByTestId('toolbox-file')).toBeHidden();

  await page.getByTestId('toggle-restricted').uncheck();

  // Every field can only take something away, so the unconfigured Creator is the most
  // capable one — which is what makes the shape checkable. The demo keys the component on
  // which deployment it is showing, because a configuration is read once when the models
  // are built; changing deployment is showing a *different* Creator, and `key` says so.
  await expect(embed(page).getByTestId('toolbox-file')).toBeVisible();
  await expect(embed(page).getByTestId('creator-tab-json')).toBeVisible();
});

test('parity/N3-strings: a white-labelled deployment says the host’s own words', async ({
  page,
}) => {
  await page.getByTestId('toggle-whitelabel').check();

  // Renaming rather than translating: the same language, a different vocabulary. The
  // eight words the host registered change and the other eighty do not.
  await expect(embed(page).getByTestId('creator-tab-design')).toHaveText('Build');
  await expect(embed(page).getByTestId('undo')).toHaveText('Step back');
  await expect(embed(page).getByLabel('Find a field')).toBeVisible();
  await expect(embed(page).getByTestId('creator-tab-json')).toHaveText('JSON');
});

test('parity/N3-theme: the tool’s colours are not the survey’s', async ({ page }) => {
  await page.getByTestId('toggle-whitelabel').check();

  // An agency's tool is their brand and their client's survey is the client's, so the
  // Creator's own chrome is themed apart from what it edits.
  await expect(embed(page).locator('.kajay-creator')).toHaveCSS(
    '--kajay-color-accent',
    '#7a3ea1',
  );
});
