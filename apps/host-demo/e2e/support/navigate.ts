import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Moves to the demo's second page.
 *
 * The demo is genuinely paginated, so a scenario touching "Logic showcase" has to walk
 * there the way a respondent does. That is the point: an assertion that could only be
 * made with every page on screen at once was never proving the flow.
 *
 * Both answers page one demands are filled unless the caller already did it. The name
 * is `isRequired`; answering it makes the nickname required in turn, through the
 * demo's own `requiredIf` chain. Without both, the validation gate refuses the move and
 * nothing past this point would run. Skipping a field that is already filled keeps a
 * scenario's own setup — "Ada Lovelace", say — intact.
 */
export async function gotoLogicShowcase(page: Page): Promise<void> {
  await fillIfEmpty(page, /What is your name\?/u, 'Ada');
  await fillIfEmpty(page, /What should we call you\?/u, 'Ada');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Logic showcase' })).toBeVisible();
}

/**
 * Moves to the demo's third page, where §C's question types live.
 *
 * Page two gates nothing of its own unless a scenario has put something wrong there,
 * so this is one more Next past the logic showcase.
 */
export async function gotoQuestionTypes(page: Page): Promise<void> {
  await gotoLogicShowcase(page);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Question types' })).toBeVisible();
}

async function fillIfEmpty(page: Page, label: RegExp, value: string): Promise<void> {
  const field = page.getByLabel(label);
  if ((await field.inputValue()) === '') {
    await field.fill(value);
  }
}
