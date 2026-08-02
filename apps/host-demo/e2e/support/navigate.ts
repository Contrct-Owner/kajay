import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Moves to the demo's second page.
 *
 * The demo is genuinely paginated, so a scenario touching "Logic showcase" has to walk
 * there the way a respondent does. That is the point: an assertion that could only be
 * made with every page on screen at once was never proving the flow.
 */
export async function gotoLogicShowcase(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Logic showcase' })).toBeVisible();
}
