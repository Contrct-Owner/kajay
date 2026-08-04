import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * The visual logic editor, against the real demo — checklist M1.
 *
 * Every edit here goes through the design surface, so the logic tab, the property grid and
 * the JSON tab are three views of one document. The scenarios cross between them on
 * purpose: that is the claim worth proving.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('tab-logic').click();
});

function logic(page: Page): Locator {
  return page.getByRole('region', { name: 'Designer logic' });
}

test('parity/M1-logic-rules: a rule added here reaches the definition', async ({ page }) => {
  await logic(page).getByLabel('What the new rule does').selectOption('show');
  await logic(page).getByLabel('What the new rule acts on').selectOption('draftScore');
  await logic(page).getByTestId('logic-add-rule').click();

  await expect(logic(page).getByTestId('logic-rule-draftScore:visibleIf')).toBeVisible();

  await page.getByTestId('tab-json').click();
  await expect(
    page.getByRole('region', { name: 'Designer JSON' }).getByLabel('Survey definition'),
  ).toHaveValue(/"visibleIf"/u);
});

test('parity/M1-condition-build: a condition is built from dropdowns', async ({ page }) => {
  await logic(page).getByLabel('What the new rule does').selectOption('show');
  await logic(page).getByLabel('What the new rule acts on').selectOption('draftScore');
  await logic(page).getByTestId('logic-add-rule').click();

  const id = 'draftScore:visibleIf-0';
  await logic(page).getByTestId(`logic-left-${id}`).selectOption('draftTier');
  await logic(page).getByTestId(`logic-operator-${id}`).selectOption('==');
  // The value cell became a picker, because `draftTier` has choices.
  await logic(page).getByTestId(`logic-value-${id}`).selectOption('silver');

  await page.getByTestId('tab-json').click();
  await expect(
    page.getByRole('region', { name: 'Designer JSON' }).getByLabel('Survey definition'),
  ).toHaveValue(/\{draftTier\} == 'silver'/u);
});

test('parity/M1-condition-refusals: what the builder cannot say is edited as text', async ({
  page,
}) => {
  await logic(page).getByLabel('What the new rule does').selectOption('show');
  await logic(page).getByLabel('What the new rule acts on').selectOption('draftScore');
  await logic(page).getByTestId('logic-add-rule').click();

  // The rule starts as a builder — its starter condition is a row of one comparison.
  await expect(logic(page).getByTestId('logic-term-draftScore:visibleIf-0')).toBeVisible();

  // Write something the dropdowns cannot represent, through the JSON tab, and the row
  // becomes a text field rather than being flattened.
  const raw = '({draftTier} = 1 or {draftTier} = 2) and {draftName} notempty';
  await page.getByTestId('tab-json').click();
  const json = page.getByRole('region', { name: 'Designer JSON' }).getByLabel('Survey definition');
  const before = await json.inputValue();
  await json.fill(before.replace(/"visibleIf": "[^"]*"/u, `"visibleIf": "${raw}"`));
  await page.getByRole('region', { name: 'Designer JSON' }).getByTestId('json-apply').click();

  await page.getByTestId('tab-logic').click();
  await expect(logic(page).getByTestId('logic-raw-draftScore:visibleIf')).toHaveValue(raw);
  await expect(logic(page).getByTestId('logic-raw-note-draftScore:visibleIf')).toBeVisible();
});

test('parity/M1-logic-edits: a rule is undoable like any other edit', async ({ page }) => {
  await logic(page).getByLabel('What the new rule does').selectOption('require');
  await logic(page).getByLabel('What the new rule acts on').selectOption('draftName');
  await logic(page).getByTestId('logic-add-rule').click();
  await expect(logic(page).getByTestId('logic-rule-draftName:requiredIf')).toBeVisible();

  await page.getByTestId('tab-design').click();
  await page.getByTestId('undo').click();

  await page.getByTestId('tab-logic').click();
  await expect(logic(page).getByTestId('logic-rule-draftName:requiredIf')).toBeHidden();
});

test('parity/M1-logic-rules: a trigger is a rule too', async ({ page }) => {
  await logic(page).getByLabel('What the new rule does').selectOption('complete');
  await logic(page).getByTestId('logic-add-rule').click();

  await expect(logic(page).getByTestId('logic-rule-trigger:0')).toContainText(
    'Complete the survey when',
  );

  await page.getByTestId('tab-json').click();
  await expect(
    page.getByRole('region', { name: 'Designer JSON' }).getByLabel('Survey definition'),
  ).toHaveValue(/"triggers"/u);
});

test('parity/M1-logic: no accessibility violations', async ({ page }) => {
  await logic(page).getByLabel('What the new rule does').selectOption('show');
  await logic(page).getByTestId('logic-add-rule').click();

  const results = await new AxeBuilder({ page }).include('[aria-label="Designer logic"]').analyze();

  expect(results.violations).toEqual([]);
});
