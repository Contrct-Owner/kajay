import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * What a host receives, on the page where it is built — checklist P3.
 *
 * Its own spec because the playground's is at the size limit, and because this is one
 * claim: the definition has had a JSON view since this page existed and the *response*
 * had none, so the thing a visitor is building towards was the one thing they could not
 * look at.
 */
const PLAYGROUND = '/playground';

function live(page: Page) {
  return page.getByTestId('live-survey');
}

test('parity/P3-playground: the response is a view of its own, beside the answer', async ({
  page,
}) => {
  await page.goto(PLAYGROUND);

  await live(page).getByLabel('What is your name?').fill('Ada');
  await page.getByTestId('live-mode-json').click();

  // The definition has had a JSON view since this page existed; the answer had none, so
  // the thing a visitor is building towards — what my application receives when somebody
  // fills this in — was the one thing they could not look at.
  await expect(page.getByTestId('live-response-json')).toContainText('"name": "Ada"');

  // And it is a view rather than a mode: the form is still there, still holding what was
  // typed into it, because a half-finished answer is exactly what somebody switching over
  // to check the JSON is in the middle of.
  await page.getByTestId('live-mode-answer').click();
  await expect(live(page).getByLabel('What is your name?')).toHaveValue('Ada');

  // Restarting empties the response, which is the same event the survey beside it shows.
  await page.getByTestId('live-restart').click();
  await page.getByTestId('live-mode-json').click();
  await expect(page.getByTestId('live-response-json')).toHaveText('{}');
});
