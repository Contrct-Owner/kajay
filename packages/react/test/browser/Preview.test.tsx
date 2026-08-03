/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * The screen between the last page and submitting.
 *
 * What only a browser shows: that the answers appear in the same controls they were
 * given in, that those controls refuse to change, and that editing puts the respondent
 * back where they were rather than at the beginning.
 */
function build(mode = 'showAllQuestions'): SurveyModel {
  return parseSurvey({
    showPreviewBeforeComplete: mode,
    pages: [
      { name: 'p1', elements: [{ type: 'text', name: 'name', title: 'Full name' }] },
      {
        name: 'p2',
        elements: [
          { type: 'text', name: 'nickname', title: 'Nickname' },
          { type: 'text', name: 'notes', title: 'Notes' },
        ],
      },
    ],
  }).survey;
}

/** Fills the first page and walks to the end. */
async function toTheEnd(screen: Awaited<ReturnType<typeof render>>): Promise<void> {
  await screen.getByLabelText('Full name').fill('Ada');
  await screen.getByRole('button', { name: 'Next' }).click();
  await screen.getByLabelText('Nickname').fill('Ada');
}

test('parity/E4-preview: the last page leads to the answers, not to the end', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);
  await toTheEnd(screen);

  await screen.getByRole('button', { name: 'Complete' }).click();

  await expect.element(screen.getByRole('heading', { name: 'Check your answers' })).toBeInTheDocument();
  // Every answer, in the control it was given in — a summary table would need its own
  // formatting per question type, and that is where the table and the form disagree.
  await expect.element(screen.getByLabelText('Full name')).toHaveValue('Ada');
  await expect.element(screen.getByLabelText('Nickname')).toHaveValue('Ada');
  expect(model.isCompleted).toBe(false);
});

test('parity/E4-preview: the answers on it cannot be changed', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);
  await toTheEnd(screen);
  await screen.getByRole('button', { name: 'Complete' }).click();

  // Nothing in the preview component says so: the survey reports itself read-only while
  // previewing, so the questions already are.
  await expect.element(screen.getByLabelText('Full name')).toHaveAttribute('readonly');
});

test('parity/E4-preview: editing returns to the page they left', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);
  await toTheEnd(screen);
  await screen.getByRole('button', { name: 'Complete' }).click();

  await screen.getByRole('button', { name: 'Edit answers' }).click();

  // Page two, answerable again. A preview that costs a respondent their place is one
  // they learn not to open.
  const nickname = screen.getByLabelText('Nickname');
  await expect.element(nickname).toHaveValue('Ada');
  await expect.element(nickname).not.toHaveAttribute('readonly');
});

test('parity/E4-preview: completing from it submits', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);
  await toTheEnd(screen);
  await screen.getByRole('button', { name: 'Complete' }).click();
  await screen.getByRole('button', { name: 'Complete' }).click();

  await expect.element(screen.getByRole('status')).toHaveTextContent('Thank you');
  expect(model.isCompleted).toBe(true);
});

test('parity/E4-preview: showAnsweredQuestions leaves out what nobody answered', async () => {
  const model = build('showAnsweredQuestions');
  const screen = await render(<Survey model={model} />);
  await toTheEnd(screen);
  await screen.getByRole('button', { name: 'Complete' }).click();

  await expect.element(screen.getByLabelText('Nickname')).toBeInTheDocument();
  // Untouched, so not part of what they are being asked to confirm.
  expect(screen.container.querySelector('[data-question-name="notes"]')).toBeNull();
});
