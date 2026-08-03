import { expect, test } from '@playwright/test';
import { answerRequiredQuestionTypes, gotoQuestionTypes } from './support/navigate.js';

/**
 * Quiz mode against the real demo — checklist E8.
 *
 * What the unit and browser suites cannot show: that `correctAnswer` is an ordinary
 * property on ordinary questions in a real definition, that the timer panel appears
 * where the page says it should and nowhere else, and that a score computed from
 * answers a respondent actually gave reaches the ending.
 *
 * Expiry is deliberately not tested here. Proving it would mean either waiting out a
 * real deadline or shortening one until the rest of the demo raced it; the browser
 * suite proves it in real Chromium against an injected clock instead.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('parity/E8-timer-panel', async ({ page }) => {
  // Page one has no deadline, so there is no panel to see. A clock on an untimed page
  // would tell the respondent they are being hurried by nothing.
  await expect(page.locator('.kajay-timer')).toHaveCount(0);

  await gotoQuestionTypes(page);

  const clock = page.locator('.kajay-timer [data-clock="page"] .kajay-timer__value');
  await expect(clock).toBeVisible();
  // `showTimerPanelMode: 'page'` — the survey clock is not drawn, because nothing
  // limits the survey as a whole.
  await expect(page.locator('.kajay-timer [data-clock="survey"]')).toHaveCount(0);

  // Counting down from the page's own ten minutes, and moving. Two readings rather
  // than one: a panel that rendered once and froze would pass a single assertion.
  const first = await clock.textContent();
  expect(first).toBe('10:00');
  await expect(clock).not.toHaveText('10:00', { timeout: 5000 });
});

test('parity/E8-quiz-scoring', async ({ page }) => {
  await gotoQuestionTypes(page);
  await answerRequiredQuestionTypes(page);

  const quiz = page.getByRole('group', { name: /A short quiz/u });
  await quiz.getByLabel('Paris').check();
  // One of the two primes, and one that is not: two marks available, one earned and
  // one taken back by the wrong tick.
  await quiz.getByLabel('2', { exact: true }).check();
  await quiz.getByLabel('9', { exact: true }).check();

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Complete' }).click();

  // 1 for the capital, 0 for the primes: `2` matched and `9` did not, and the two
  // cancel. The denominator counts marks, so the checkbox contributes two of the three.
  await expect(page.getByTestId('quiz-score')).toHaveText('You scored 1 of 3 on the quiz.');
});

test('parity/E8-quiz-scoring: ticking everything scores nothing', async ({ page }) => {
  await gotoQuestionTypes(page);
  await answerRequiredQuestionTypes(page);

  const quiz = page.getByRole('group', { name: /A short quiz/u });
  await quiz.getByLabel('Paris').check();
  // One at a time and written out, because these are clicks: a respondent cannot tick
  // four boxes at once, and neither can a scenario that means to be believed.
  await quiz.getByLabel('2', { exact: true }).check();
  await quiz.getByLabel('3', { exact: true }).check();
  await quiz.getByLabel('4', { exact: true }).check();
  await quiz.getByLabel('9', { exact: true }).check();

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Complete' }).click();

  // The whole reason wrong choices are charged for: two right and two wrong cancel
  // exactly, so the respondent who ticks the lot earns only the capital.
  await expect(page.getByTestId('quiz-score')).toHaveText('You scored 1 of 3 on the quiz.');
});
