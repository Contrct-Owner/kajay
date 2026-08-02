import { expect, test } from '@playwright/test';
import { gotoLogicShowcase, gotoQuestionTypes } from './support/navigate.js';

/**
 * Navigation, panels and completion — checklist §E.
 *
 * Split from phase0.spec.ts when that file outgrew the repo's own file-size limit.
 * These scenarios share a subject: what the respondent walks through, rather than what
 * any one question does.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('parity/E5-completion-flow', async ({ page }) => {
  await page.getByLabel(/What is your name\?/u).fill('Ada');
  await gotoQuestionTypes(page);
  // Complete only exists on the last page: the primary button is one control that
  // changes label, so it never moves out from under the cursor.
  await page.getByRole('button', { name: 'Complete' }).click();

  const ending = page.getByRole('status');
  // The author's markup, rendered as markup — the heading is an element rather than
  // four characters of text.
  await expect(ending.getByRole('heading', { name: 'Thanks, Ada.' })).toBeVisible();
  // `{answeredCount}` is a calculated value, not an answer, and the ending cannot tell
  // the difference. That is checklist B6's second half.
  await expect(ending).toContainText('You answered 2 of the first three questions.');
});

test('parity/E5-completed-html-on-condition', async ({ page }) => {
  await gotoLogicShowcase(page);
  // `click`, not `check`: the trigger completes the survey on the spot, so the radio
  // is gone before `check` can confirm it is checked.
  await page.getByLabel('Yes, finish now').click();

  const ending = page.getByRole('status');
  // A different ending, chosen by its own condition rather than by the default.
  await expect(ending.getByRole('heading', { name: 'Finished early' })).toBeVisible();
  await expect(ending).not.toContainText('You answered');
});

test('parity/I1-theme-tokens-applied', async ({ page }) => {
  // Proves the host's `@kajay/themes/styles.css` import resolved through the exports map.
  const radius = await page
    .locator('.kajay-survey')
    .evaluate((element) => getComputedStyle(element).getPropertyValue('--kajay-radius').trim());
  expect(radius).toBe('8px');
});

test('parity/E1-panels', async ({ page }) => {
  await gotoLogicShowcase(page);

  // The group is governed by one rule: no plan, no billing.
  const billing = page.getByRole('group', { name: 'Billing' });
  await expect(billing).toHaveCount(0);

  await page.getByLabel('paid').check();
  await expect(billing).toBeVisible();
  // Nested: Estimate lives inside Billing, and appears with it.
  await expect(page.getByRole('group', { name: 'Estimate' })).toBeVisible();
  await expect(page.getByLabel('Annual estimate')).toBeVisible();
});

test('parity/E1-panel-collapse', async ({ page }) => {
  await gotoLogicShowcase(page);
  await page.getByLabel('paid').check();

  const toggle = page.getByRole('button', { name: 'Billing' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Monthly price')).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel('Monthly price')).toHaveCount(0);

  // Collapsing hides; it does not clear. The answer is still there on the way back.
  await toggle.click();
  await expect(page.getByLabel('Monthly price')).toBeVisible();
});

test('parity/E2-navigation', async ({ page }) => {
  const position = page.getByTestId('page-position');
  await expect(position).toHaveText('Page 1 of 3');
  // Nowhere to go back to yet, so the control is absent rather than disabled.
  await expect(page.getByRole('button', { name: 'Previous' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();

  await gotoLogicShowcase(page);
  await expect(position).toHaveText('Page 2 of 3');
  await expect(page.getByRole('heading', { name: 'About you' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(position).toHaveText('Page 1 of 3');
  await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();
});

test('parity/E2-navigation: answers survive leaving and returning to a page', async ({ page }) => {
  await page.getByLabel(/What is your name\?/u).fill('Ada Lovelace');
  await gotoLogicShowcase(page);
  await page.getByRole('button', { name: 'Previous' }).click();

  // Navigation is a view change, not a lifecycle event: nothing is unmounted out of
  // the model, so the answer is still in `data` and still in the field.
  await expect(page.getByLabel(/What is your name\?/u)).toHaveValue('Ada Lovelace');
  await expect(page.getByTestId('survey-data')).toContainText('Ada Lovelace');
});

test('parity/B7-trigger-skip', async ({ page }) => {
  await gotoLogicShowcase(page);
  // `click`, not `check`: the trigger navigates away, so the radio `check` would wait
  // to confirm is no longer on screen — the same reason the complete trigger uses it.
  await page.getByLabel('Not yet').click();

  // The trigger moved the respondent, and the renderer followed.
  await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();
  await expect(page.getByTestId('page-position')).toHaveText('Page 1 of 3');
});

test('parity/E9-clear-invisible-values', async ({ page }) => {
  await page.getByLabel(/What is your name\?/u).fill('Ada');
  await page.getByLabel(/What should we call you\?/u).fill('Ada');
  await page.getByLabel('Email address').fill('ada@example.com');

  const data = page.getByTestId('survey-data');
  await expect(data).toContainText('"nickname": "Ada"');
  await expect(data).toContainText('"greeting": "Hello, Ada"');

  // Emptying the name takes the branch under it out of reach. `onHidden` means the
  // answers go with it — and the greeting, which was only reachable through the
  // nickname, goes in the same keystroke rather than a sweep later.
  await page.getByLabel(/What is your name\?/u).fill('');
  await expect(page.getByLabel(/What should we call you\?/u)).toHaveCount(0);
  await expect(data).not.toContainText('nickname');
  await expect(data).not.toContainText('greeting');

  // The email is *disabled* by the same chain, not hidden, and a disabled question is
  // still one the respondent can see they answered. The policy is about invisible
  // values, and this is the line it draws.
  await expect(page.getByLabel('Email address')).toBeDisabled();
  await expect(data).toContainText('"email": "ada@example.com"');

  // And it is destruction, not concealment: the branch comes back empty.
  await page.getByLabel(/What is your name\?/u).fill('Ada');
  await expect(page.getByLabel(/What should we call you\?/u)).toHaveValue('');
});

test('parity/E6-save-and-resume', async ({ page }) => {
  await page.getByLabel(/What is your name\?/u).fill('Ada');
  await page.getByLabel(/What should we call you\?/u).fill('Ada');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Logic showcase' })).toBeVisible();
  await page.getByLabel('paid').check();

  // A real reload, not a re-render: the model is rebuilt from the definition and the
  // host hands back what it stored on the way through.
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Logic showcase' })).toBeVisible();
  await expect(page.getByLabel('paid')).toBeChecked();
  await expect(page.getByTestId('survey-data')).toContainText('"fullName": "Ada"');
});

test('parity/E6-save-and-resume: a finished survey does not resume', async ({ page }) => {
  await page.getByLabel(/What is your name\?/u).fill('Ada');
  await gotoQuestionTypes(page);
  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('status')).toContainText('You answered');

  await page.reload();

  // Back at the beginning with nothing filled in. Resuming into a survey they already
  // submitted would invite a second submission of the same answers.
  await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();
  await expect(page.getByLabel(/What is your name\?/u)).toHaveValue('');
});
