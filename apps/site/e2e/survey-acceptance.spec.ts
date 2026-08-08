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
