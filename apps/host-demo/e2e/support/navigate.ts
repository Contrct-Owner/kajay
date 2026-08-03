import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

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
  await fillIfEmpty(page.getByLabel(/What is your name\?/u), 'Ada');
  await fillIfEmpty(page.getByLabel(/What should we call you\?/u), 'Ada');
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

/**
 * Fills what page three demands before it will complete.
 *
 * The workplace question has a required field, and a composite question reports its
 * parts even when nothing at all has been typed into it — which is the point of marking
 * a field required, and which means an untouched page three refuses to complete. Any
 * scenario that means to get *past* the gate says so by calling this; the ones about the
 * gate itself do not.
 */
export async function answerRequiredQuestionTypes(page: Page): Promise<void> {
  const workplace = page.getByRole('group', { name: /Where do you work\?/u });
  await fillIfEmpty(workplace.getByLabel('Street'), '12 Long Road');
}

async function fillIfEmpty(field: Locator, value: string): Promise<void> {
  if ((await field.inputValue()) === '') {
    await field.fill(value);
  }
}
