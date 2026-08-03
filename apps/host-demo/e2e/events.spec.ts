import { expect, test } from '@playwright/test';
import { gotoQuestionTypes } from './support/navigate.js';

/**
 * The typed event surface, heard the way a host hears it — checklist A7.
 *
 * Its own file rather than a tail on the question-type suite: what these prove is not
 * that a question works but that *something other than the renderer* is told when one
 * changes, which is the promise the whole event surface exists to make.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await gotoQuestionTypes(page);
});

test('parity/A7-model-events', async ({ page }) => {
  const log = page.getByTestId('event-log');
  const expenses = page.getByRole('group', { name: /Anything to expense\?/u });

  await expenses.getByRole('button', { name: 'Add a line' }).click();
  // Heard by a listener with no connection to the renderer: the event comes from the
  // model, so anything watching hears it however the change was caused.
  await expect(log).toContainText('added expenses[1] (2)');

  const travellers = page.getByRole('group', { name: /Who else is coming\?/u });
  await travellers.getByRole('button', { name: 'Add a traveller' }).click();
  // The same channel for a repeating panel, because a row and an instance are one thing.
  await expect(log).toContainText('added travellers[1] (2)');

  await page.getByLabel('Attach your receipts').setInputFiles({
    name: 'receipt.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('a taxi fare'),
  });
  await expect(log).toContainText('attached evidence: receipt.txt');

  await page.getByRole('button', { name: 'Remove receipt.txt' }).click();
  await expect(log).toContainText('removed evidence: receipt.txt');
});
