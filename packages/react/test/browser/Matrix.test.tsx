/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * A matrix in a real DOM — checklist F1.
 *
 * What a unit test cannot see is the entire accessibility question: whether a cell says
 * which row and which column it belongs to, whether the table is a table, and whether a
 * read-only matrix refuses a click that the model would otherwise happily record. A
 * matrix that reads as thirty unlabelled radio buttons is the classic failure, and it is
 * invisible from the model.
 */
function build(overrides: Readonly<Record<string, unknown>> = {}): SurveyModel {
  return parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'matrix',
            name: 'comparison',
            title: 'How do these compare?',
            columns: [
              { value: 1, text: 'First' },
              { value: 2, text: 'Second' },
            ],
            rows: [
              { value: 'docs', text: 'Documentation' },
              { value: 'support', text: 'Support' },
            ],
            ...overrides,
          },
        ],
      },
    ],
  }).survey;
}

test('parity/F1-matrix: a cell is named by its row and its column', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  // "Documentation Second" — the whole question that cell asks. The accessible name is
  // built from the two headers, so nothing has to be repeated into each of the four
  // cells and a wider matrix does not multiply the text.
  const cell = screen.getByRole('radio', { name: 'Documentation Second' });
  await cell.click();

  expect(model.data).toEqual({ comparison: { docs: 2 } });
  await expect.element(cell).toBeChecked();
});

test('parity/F1-matrix: the columns are a header row, once, for every row below', async () => {
  const screen = await render(<Survey model={build()} />);

  await expect.element(screen.getByRole('columnheader', { name: 'First' })).toBeInTheDocument();
  await expect
    .element(screen.getByRole('rowheader', { name: 'Documentation' }))
    .toBeInTheDocument();
});

test('parity/F1-matrix: a row holds one answer', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('radio', { name: 'Documentation First' }).click();
  await screen.getByRole('radio', { name: 'Documentation Second' }).click();

  expect(model.data).toEqual({ comparison: { docs: 2 } });
  // The radios of one row share a name, so the browser itself enforces the arity — a
  // respondent moving through the row with the arrow keys gets the behaviour they
  // expect from a radio group rather than one this code invented.
  await expect.element(screen.getByRole('radio', { name: 'Documentation First' })).not.toBeChecked();
});

test('parity/F1-matrix: rows are answered independently', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('radio', { name: 'Documentation First' }).click();
  await screen.getByRole('radio', { name: 'Support First' }).click();

  expect(model.data).toEqual({ comparison: { docs: 1, support: 1 } });
});

test('parity/F1-matrix: a row message sits beside its own row', async () => {
  const model = build({ isAllRowRequired: true });
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('radio', { name: 'Support First' }).click();
  await screen.getByRole('button', { name: 'Complete' }).click();

  // Against the row that is missing, and describing its cells — not one message at the
  // top of an eight-row table saying that something, somewhere, is wrong.
  await expect
    .element(screen.getByRole('radio', { name: 'Documentation First' }))
    .toHaveAttribute('aria-invalid', 'true');
  await expect
    .element(screen.getByRole('radio', { name: 'Support First' }))
    .not.toHaveAttribute('aria-invalid');
  await expect
    .element(screen.getByText('This row requires an answer.'))
    .toBeInTheDocument();
});

test('parity/F1-matrix: a read-only matrix does not record a click', async () => {
  const model = build({ readOnly: true });
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('radio', { name: 'Documentation First' }).click();

  // Cancelling the click's default would stop the browser checking the radio but not
  // React reporting the change, so the guard is on the handler — see E7.
  expect(model.data).toEqual({});
  await expect.element(screen.getByRole('group')).toHaveAttribute('aria-readonly', 'true');
});

test('parity/F1-matrix: alternateRows is on the table, where the styling can reach it', async () => {
  const screen = await render(<Survey model={build({ alternateRows: true })} />);

  await expect.element(screen.getByRole('table')).toHaveClass('kajay-matrix--alternate');
});

test('parity/F1-matrix: a hidden row is not drawn', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'mode', title: 'Mode' },
          {
            type: 'matrix',
            name: 'comparison',
            title: 'How do these compare?',
            columns: [{ value: 1, text: 'First' }],
            rows: [
              { value: 'docs', text: 'Documentation' },
              { value: 'price', text: 'Price', visibleIf: "{mode} = 'full'" },
            ],
          },
        ],
      },
    ],
  }).survey;
  const screen = await render(<Survey model={model} />);

  await expect.element(screen.getByRole('rowheader', { name: 'Price' })).not.toBeInTheDocument();

  model.setValue('mode', 'full');
  // Rows are governed by the same engine as everything else: `visibleIf` on a row is
  // the rule a choice already had, asked of the collection beside it.
  await expect.element(screen.getByRole('rowheader', { name: 'Price' })).toBeInTheDocument();
});

test('parity/C11-multipletext: a question-level message has somewhere to appear', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'multipletext',
            name: 'address',
            title: 'Where do you live?',
            isRequired: true,
            items: [{ name: 'street', title: 'Street' }],
          },
        ],
      },
    ],
  }).survey;
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('button', { name: 'Complete' }).click();

  // It was reported against the question rather than any field, and the renderer drew
  // only per-field messages — so this one existed in the model and nowhere on screen.
  await expect
    .element(screen.getByText('This question requires an answer.'))
    .toBeInTheDocument();
});
