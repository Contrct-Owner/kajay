import { expect, test } from '@playwright/test';
import { gotoQuestionTypes } from './support/navigate.js';

/**
 * Files and signatures — checklist §H — against a host that stores them.
 *
 * The demo's storage is in memory, which is the point: what the rows are about is the
 * seam, and the library never sees a `File`, never fetches and never decides where
 * anything is kept.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await gotoQuestionTypes(page);
});

test('parity/H1-file', async ({ page }) => {
  const evidence = page.getByLabel('Attach your receipts');
  await evidence.setInputFiles({
    name: 'receipt.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('a taxi fare'),
  });

  // The host stored it and the response carries the reference it gave back — not a
  // megabyte of base64, which is the whole reason the seam exists.
  const data = page.getByTestId('survey-data');
  await expect(data).toContainText('"name": "receipt.txt"');
  await expect(data).toContainText('"url"');
  await expect(data).not.toContainText('"content"');
});

test('parity/H1-file: the rules are the model own, not the picker hints', async ({ page }) => {
  const evidence = page.getByLabel('Attach your receipts');
  // Dragged past `accept` is exactly how a respondent gets here: the attribute is an
  // affordance, and `setInputFiles` ignores it the same way a drop does.
  await evidence.setInputFiles({
    name: 'notes.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: Buffer.from('nope'),
  });
  // Wait for it to actually be attached before pressing the gate. Reading a file and
  // storing it are asynchronous, so clicking straight after `setInputFiles` raced the
  // attachment: the gate ran against an empty answer, found nothing wrong with the
  // *file*, and `checkErrorsMode: 'onNextPage'` correctly declined to re-check it when
  // the entry landed a moment later. The scenario was flaky; what it is about was not.
  await expect(page.getByRole('button', { name: 'Remove notes.docx' })).toBeVisible();

  await page.getByRole('button', { name: 'Complete' }).click();

  await expect(
    page.getByText('"notes.docx" is not one of the accepted file types (image/*,.pdf,.txt).'),
  ).toBeVisible();
});

test('parity/H3-file-seams', async ({ page }) => {
  const evidence = page.getByLabel('Attach your receipts');
  await evidence.setInputFiles({
    name: 'receipt.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('a taxi fare'),
  });
  await expect(page.getByTestId('survey-data')).toContainText('receipt.txt');

  // Detaching tells the host, which is what H3 is for: its copy is no longer wanted.
  await page.getByRole('button', { name: 'Remove receipt.txt' }).click();
  await expect(page.getByTestId('survey-data')).not.toContainText('receipt.txt');
});

test('parity/H2-signature', async ({ page }) => {
  const pad = page.locator('[data-question-name="signature"] canvas');
  // Scrolled into view *before* measuring: `boundingBox` is viewport-relative, so a pad
  // below the fold gives coordinates that land somewhere else entirely. C9's drag
  // taught this once already.
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  if (box === null) {
    throw new Error('expected the signature pad to be laid out');
  }

  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 80, { steps: 8 });
  await page.mouse.up();

  await expect(page.getByTestId('survey-data')).toContainText('"signature": "data:image/png');

  await page.getByRole('button', { name: 'Clear signature' }).click();
  await expect(page.getByTestId('survey-data')).not.toContainText('"signature"');
});
