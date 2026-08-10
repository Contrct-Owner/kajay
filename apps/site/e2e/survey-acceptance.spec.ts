import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Result } from 'axe-core';

const PLAYGROUND = '/playground';

function liveSurvey(page: Page) {
  return page.getByTestId('live-survey');
}

async function violations(page: Page): Promise<readonly { id: string; nodes: number }[]> {
  const results = await new AxeBuilder({ page })
    .include('[data-testid="live-survey"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map((violation: Result) => ({
    id: violation.id,
    nodes: violation.nodes.length,
  }));
}

test('parity/I1-tokens: the published stylesheet styles the playground survey', async ({
  page,
}) => {
  await page.goto(PLAYGROUND);

  const survey = liveSurvey(page).locator('form.kajay-survey');
  await expect(survey).toHaveCSS('border-radius', '8px');
  expect(
    await survey.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--kajay-radius').trim(),
    ),
  ).toBe('8px');
});

test('parity/I1-tokens: a group question’s title fills its fieldset', async ({ page }) => {
  await page.goto(PLAYGROUND);

  // **A `legend` sizes itself, and the browsers disagree about how.** Seven question types
  // draw their title as one, because a control that is a *group* needs a fieldset for the
  // title to be the group's name. A legend is not laid out like its siblings: engines
  // shrink it to its own content rather than giving it the box's width — and Firefox then
  // rounds that a fraction under what the text measured, so `How was it?` broke in half on
  // the design canvas with five hundred pixels free beside it.
  //
  // **The symptom was Firefox's; the cause is visible anywhere**, which is what makes this
  // assertable in the one engine this suite runs. A legend 91px wide inside a 613px
  // fieldset is wrong in Chromium too — it is simply wrong in a way Chromium's rounding
  // happened to hide. Asserting the *cause* rather than the wrap is what lets a
  // single-engine suite catch a cross-engine bug.
  const group = liveSurvey(page).locator('fieldset.kajay-question').first();
  const legend = group.locator('legend.kajay-question__title');

  const [groupBox, legendBox] = await Promise.all([group.boundingBox(), legend.boundingBox()]);
  expect(legendBox?.width).toBeGreaterThan((groupBox?.width ?? 0) - 2);
  // One line. The height is the other half of the claim: a title that fills its box and
  // still wraps would mean something else entirely.
  expect(legendBox?.height).toBeLessThan(40);
});

test('parity/J4-keyboard: the playground survey can be answered without a pointer', async ({
  page,
}) => {
  await page.goto(PLAYGROUND);
  const survey = liveSurvey(page);

  const name = survey.getByLabel('What is your name?');
  await name.focus();
  await page.keyboard.type('Ada');
  await expect(name).toHaveValue('Ada');

  const rating = survey.getByRole('radiogroup', { name: 'How was it?' });
  await rating.getByRole('radio', { name: 'Great' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(rating.getByRole('radio', { name: 'Fine' })).toBeChecked();
});

test('parity/J5-axe: the public playground survey passes WCAG checks', async ({ page }) => {
  await page.goto(PLAYGROUND);
  expect(await violations(page)).toEqual([]);
});

test('parity/J5-axe: the public playground survey passes WCAG checks in dark mode', async ({
  page,
}) => {
  await page.goto(PLAYGROUND);
  await page.getByTestId('theme-toggle').click();
  expect(await violations(page)).toEqual([]);
});
