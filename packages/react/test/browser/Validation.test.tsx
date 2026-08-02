/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * What validation does in a real DOM: where the message lands, what the field announces
 * about itself, and where focus goes. None of it is observable from the model alone.
 */
function build(definition: Readonly<Record<string, unknown>>): SurveyModel {
  return parseSurvey(definition).survey;
}

function twoRequired(extra: Readonly<Record<string, unknown>> = {}): SurveyModel {
  return build({
    ...extra,
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'first', title: 'First' },
          { type: 'text', name: 'second', title: 'Second', isRequired: true },
        ],
      },
    ],
  });
}

test('parity/D1-required: a refused move shows the message and marks the field', async () => {
  const model = twoRequired();
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('button', { name: 'Complete' }).click();

  const message = screen.getByRole('alert');
  await expect.element(message).toHaveTextContent('This question requires an answer.');
  // The field points at the message, so a screen reader reads them together.
  const field = screen.getByLabelText(/Second/u);
  await expect.element(field).toHaveAttribute('aria-invalid', 'true');
  await expect
    .element(field)
    .toHaveAttribute('aria-describedby', 'kajay-question-second-errors');
  expect(model.isCompleted).toBe(false);
});

test('parity/D6-focus-first-error: focus moves to the question that blocked the move', async () => {
  const model = twoRequired();
  const screen = await render(<Survey model={model} />);

  // Focus starts on the button the respondent pressed, which is the whole problem the
  // row exists to solve: without this they have to hunt for what went wrong.
  await screen.getByRole('button', { name: 'Complete' }).click();

  const field = screen.getByLabelText(/Second/u);
  await expect.element(field).toHaveFocus();
});

/** Where the error sits inside its question, as an index among the question's children. */
async function errorOffsetFromInput(model: SurveyModel): Promise<number> {
  const screen = await render(<Survey model={model} />);
  await screen.getByRole('button', { name: 'Complete' }).click();
  await expect.element(screen.getByRole('alert')).toBeVisible();

  const children = [...(document.querySelector('[data-question-name="second"]')?.children ?? [])];
  const positionOf = (selector: string): number =>
    children.findIndex((child) => child.matches(selector));
  return positionOf('.kajay-question__errors') - positionOf('input');
}

test('parity/D5-error-location: errors draw above the field by default', async () => {
  // Above, so the respondent reads the objection before the field it is about.
  expect(await errorOffsetFromInput(twoRequired())).toBeLessThan(0);
});

test('parity/D5-error-location: questionErrorLocation moves them below', async () => {
  // Set in the definition rather than through the setter, because that is the form
  // that serializes — and because a policy change fires no event, so a renderer already
  // showing an error would not redraw for it.
  expect(await errorOffsetFromInput(twoRequired({ questionErrorLocation: 'bottom' }))).toBeGreaterThan(
    0,
  );
});

test('parity/D5-check-errors-mode: onValueChanged reports as the respondent types', async () => {
  const model = build({
    checkErrorsMode: 'onValueChanged',
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'text',
            name: 'code',
            title: 'Code',
            validators: [{ type: 'textvalidator', minLength: 4 }],
          },
        ],
      },
    ],
  });
  const screen = await render(<Survey model={model} />);

  await screen.getByLabelText(/Code/u).fill('ab');
  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Please enter at least 4 characters.');

  await screen.getByLabelText(/Code/u).fill('abcd');
  expect(document.querySelector('[role="alert"]')).toBeNull();
});

test('parity/D3-async-validators: the primary button says it is waiting, and stays put', async () => {
  const model = build({ pages: [{ name: 'p1', elements: [{ type: 'text', name: 'code' }] }] });
  let release: (() => void) | undefined;
  model.validation.setServerValidator(
    () =>
      new Promise((resolve) => {
        release = () => resolve([]);
      }),
  );
  model.setValue('code', 'KJ-1');

  const screen = await render(<Survey model={model} />);
  await screen.getByRole('button', { name: 'Complete' }).click();

  // One control that changes text, never one that swaps places — the wait must not
  // move the button out from under a cursor already aimed at it.
  const button = screen.getByRole('button', { name: 'Checking…' });
  await expect.element(button).toBeDisabled();
  await expect.element(button).toHaveAttribute('aria-busy', 'true');

  release?.();
  await expect.element(screen.getByRole('status')).toBeVisible();
});

test('parity/D4-server-validation: a failed check is reported as a failed check', async () => {
  const model = build({ pages: [{ name: 'p1', elements: [{ type: 'text', name: 'code' }] }] });
  model.validation.setServerValidator(() => Promise.reject(new Error('Network down')));
  model.setValue('code', 'KJ-1');

  const screen = await render(<Survey model={model} />);
  await screen.getByRole('button', { name: 'Complete' }).click();

  // Not attached to the field: no answer is at fault, and saying otherwise would send
  // the respondent looking for a mistake they did not make.
  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('We could not check your answers: Network down');
  expect(document.querySelector('.kajay-question__errors')).toBeNull();
  expect(model.isCompleted).toBe(false);
});

test('parity/D2-validators: a select question reports through its group', async () => {
  const model = build({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'checkbox',
            name: 'topics',
            title: 'Topics',
            choices: ['a', 'b', 'c'],
            validators: [{ type: 'answercountvalidator', minCount: 2 }],
          },
        ],
      },
    ],
  });
  const screen = await render(<Survey model={model} />);

  await screen.getByLabelText('a').click();
  await screen.getByRole('button', { name: 'Complete' }).click();

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Please select at least 2 options.');
  await expect
    .element(screen.getByRole('group', { name: /Topics/u }))
    .toHaveAttribute('aria-invalid', 'true');
});
