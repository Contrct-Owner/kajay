/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * Rows a respondent adds — checklist F3, in a real DOM.
 *
 * The model's own tests prove what the answer becomes. What only a browser can show is
 * that the row a respondent typed into is the row that survives a removal, and that
 * confirming a deletion is something they can actually do with the keyboard.
 */
function build(overrides: Readonly<Record<string, unknown>> = {}): SurveyModel {
  return parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'matrixdynamic',
            name: 'basket',
            title: 'What are you ordering?',
            rowTitleFormat: 'Item {0}',
            columns: [
              { type: 'text', name: 'item', title: 'Item' },
              { type: 'text', name: 'quantity', title: 'Quantity', inputType: 'number' },
            ],
            totals: [{ column: 'quantity', kind: 'sum', format: '{0} in total' }],
            ...overrides,
          },
        ],
      },
    ],
  }).survey;
}

test('parity/F3-matrix-dynamic: a row is added and answered', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('textbox', { name: 'Item 1 Item' }).fill('Pens');
  await screen.getByRole('button', { name: 'Add row' }).click();
  await screen.getByRole('textbox', { name: 'Item 2 Item' }).fill('Paper');

  // Two rows, each with its own answers — and each cell labelled by the row it is in,
  // which is the difference between a table and a pile of identical inputs.
  expect(model.data).toEqual({ basket: [{ item: 'Pens' }, { item: 'Paper' }] });
});

test('parity/F3-matrix-dynamic: removing a row keeps the others intact', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('textbox', { name: 'Item 1 Item' }).fill('Pens');
  await screen.getByRole('button', { name: 'Add row' }).click();
  await screen.getByRole('textbox', { name: 'Item 2 Item' }).fill('Paper');

  await screen.getByRole('button', { name: 'Remove' }).first().click();

  expect(model.data).toEqual({ basket: [{ item: 'Paper' }] });
  // The survivor moved up and the field shows it, rather than the row number and the
  // answers drifting apart.
  await expect
    .element(screen.getByRole('textbox', { name: 'Item 1 Item' }))
    .toHaveValue('Paper');
});

test('parity/F3-confirm-delete: a destructive click asks first, in the page', async () => {
  const model = build({ confirmDelete: true, confirmDeleteText: 'Really remove it?', minRowCount: 2 });
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('textbox', { name: 'Item 1 Item' }).fill('Pens');
  await screen.getByRole('button', { name: 'Add row' }).click();
  await screen.getByRole('button', { name: 'Remove' }).first().click();

  // Nothing has gone yet, and the question is a control on the page rather than a
  // native dialog — which cannot be styled, translated, or navigated back out of.
  expect(model.data).toEqual({ basket: [{ item: 'Pens' }, {}, {}] });

  await screen.getByRole('button', { name: 'Keep' }).click();
  expect(model.data).toEqual({ basket: [{ item: 'Pens' }, {}, {}] });

  await screen.getByRole('button', { name: 'Remove' }).first().click();
  await screen.getByRole('button', { name: 'Really remove it?' }).click();
  expect(model.data).toEqual({ basket: [{}, {}] });
});

test('parity/F3-row-limits: the add button goes away at the ceiling', async () => {
  const model = build({ maxRowCount: 2 });
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('button', { name: 'Add row' }).click();

  await expect.element(screen.getByRole('button', { name: 'Add row' })).not.toBeInTheDocument();
});

test('parity/F3-matrix-dynamic: the total follows the rows', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('spinbutton', { name: 'Item 1 Quantity' }).fill('2');
  await screen.getByRole('button', { name: 'Add row' }).click();
  await screen.getByRole('spinbutton', { name: 'Item 2 Quantity' }).fill('3');

  await expect.element(screen.getByText('5 in total')).toBeInTheDocument();

  await screen.getByRole('button', { name: 'Remove' }).last().click();
  await expect.element(screen.getByText('2 in total')).toBeInTheDocument();
});
