import { expect, test } from '@playwright/test';
import { answerRequiredQuestionTypes, gotoQuestionTypes } from './support/navigate.js';

/**
 * Repeating panels — checklist §G — in a host that authored one as plain JSON.
 *
 * Its own file by subject, like the matrix spec: what a group of questions asked several
 * times does, rather than what any single question does.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await gotoQuestionTypes(page);
});

test('parity/G1-paneldynamic', async ({ page }) => {
  const travellers = page.getByRole('group', { name: /Who else is coming/u });
  await travellers.getByRole('textbox', { name: 'Traveller 1 Name' }).fill('Ada');
  await travellers.getByRole('button', { name: 'Add a traveller' }).click();
  await travellers.getByRole('textbox', { name: 'Traveller 2 Name' }).fill('Grace');

  // The instances are the answer: an array of records, one per traveller.
  const data = page.getByTestId('survey-data');
  await expect(data).toContainText('"fullName": "Ada"');
  await expect(data).toContainText('"fullName": "Grace"');

  // Removing asks first, in the page — a panel can hold a lot of typing.
  await travellers.getByRole('button', { name: 'Remove' }).first().click();
  await travellers.getByRole('button', { name: 'Remove this one?' }).click();
  await expect(travellers.getByRole('textbox', { name: 'Traveller 1 Name' })).toHaveValue('Grace');
});

test('parity/G3-panel-scope', async ({ page }) => {
  const travellers = page.getByRole('group', { name: /Who else is coming/u });
  await travellers.getByRole('button', { name: 'Add a traveller' }).click();
  await travellers.getByRole('spinbutton', { name: 'Traveller 2 Age' }).fill('12');

  // `{panel.age}` is *this* traveller's age: the group appears under the instance that
  // asked for it, and nowhere else.
  await expect(travellers.getByRole('group', { name: 'Travelling with a minor' })).toHaveCount(1);
  await expect(
    travellers.getByRole('textbox', { name: 'Traveller 2 Responsible adult' }),
  ).toBeVisible();
});

test('parity/G4-nested-composites: a required question inside a nested group still gates', async ({
  page,
}) => {
  await answerRequiredQuestionTypes(page);
  const travellers = page.getByRole('group', { name: /Who else is coming/u });
  await travellers.getByRole('spinbutton', { name: 'Traveller 1 Age' }).fill('9');

  await page.getByRole('button', { name: 'Complete' }).click();

  // Two levels down — an instance, then a group inside it — and the page still refuses.
  await expect(
    travellers.getByRole('textbox', { name: 'Traveller 1 Responsible adult' }),
  ).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('heading', { name: 'Check your answers' })).toHaveCount(0);

  await travellers.getByRole('textbox', { name: 'Traveller 1 Responsible adult' }).fill('Ada');
  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('heading', { name: 'Check your answers' })).toBeVisible();
});
