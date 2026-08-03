/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import type { QuestionRendererProps } from '@kajay/react';
import { defaultPageElementRenderers } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * A table of question cells in a real DOM — checklist F2.
 *
 * What matters here is not visible from the model: that a cell really is drawn by the
 * renderer registered for its type, including a host's own replacement, and that each
 * control says which row and column it belongs to. A matrix whose cells were drawn by
 * bespoke code inside the matrix renderer would pass every unit test in the suite and
 * still be a second, diverging implementation of every question type.
 */
function build(): SurveyModel {
  return parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'matrixcells',
            name: 'basket',
            title: 'Your order',
            rows: [
              { value: 'pens', text: 'Pens' },
              { value: 'paper', text: 'Paper' },
            ],
            columns: [
              {
                type: 'dropdown',
                name: 'size',
                title: 'Size',
                choices: [
                  { value: 'small', text: 'Small' },
                  { value: 'large', text: 'Large' },
                ],
              },
              { type: 'text', name: 'quantity', title: 'Quantity', inputType: 'number' },
              {
                type: 'comment',
                name: 'notes',
                title: 'Notes',
                visibleIf: "{row.size} = 'large'",
              },
            ],
            totals: [{ column: 'quantity', kind: 'sum', format: '{0} items' }],
          },
        ],
      },
    ],
  }).survey;
}

test('parity/F2-matrix-cells: a cell is drawn by its own type renderer', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  // A real `select` and a real number field, because the column said `dropdown` and
  // `text` — not markup the matrix invented.
  await expect
    .element(screen.getByRole('combobox', { name: 'Pens Size' }))
    .toBeInTheDocument();
  await expect
    .element(screen.getByRole('spinbutton', { name: 'Paper Quantity' }))
    .toHaveAttribute('type', 'number');
});

test('parity/F2-matrix-cells: a cell records its answer under its own row', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('spinbutton', { name: 'Pens Quantity' }).fill('3');

  // Typed, not stringified: the cell is a real text question, so C1's number handling
  // applies inside a table without the matrix knowing about it.
  expect(model.data).toEqual({ basket: { pens: { quantity: 3 } } });
});

test('parity/F2-cell-conditions: a cell appears in the row that asked for it', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  await expect.element(screen.getByRole('textbox', { name: 'Pens Notes' })).not.toBeInTheDocument();

  await screen.getByRole('combobox', { name: 'Pens Size' }).selectOptions('large');

  // Only that row: the column's `{row.size}` was rewritten per cell when it was built.
  await expect.element(screen.getByRole('textbox', { name: 'Pens Notes' })).toBeInTheDocument();
  await expect
    .element(screen.getByRole('textbox', { name: 'Paper Notes' }))
    .not.toBeInTheDocument();
});

test('parity/F2-column-totals: the total is drawn under its column and follows the answers', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('spinbutton', { name: 'Pens Quantity' }).fill('3');
  await screen.getByRole('spinbutton', { name: 'Paper Quantity' }).fill('4');

  await expect.element(screen.getByText('7 items')).toBeInTheDocument();
});

test('parity/F2-matrix-cells: the columns head the table once', async () => {
  const screen = await render(<Survey model={build()} />);

  await expect.element(screen.getByRole('columnheader', { name: 'Size' })).toBeInTheDocument();
  await expect.element(screen.getByRole('rowheader', { name: 'Pens' })).toBeInTheDocument();
});

test("parity/F2-matrix-cells: a host's own renderer draws the cells too", async () => {
  const renderers = defaultPageElementRenderers.clone();
  renderers.registerQuestion('text', function HostText({ question }: QuestionRendererProps) {
    return <div data-testid="host-cell">{question.title}</div>;
  });

  const screen = await render(<Survey model={build()} renderers={renderers} />);

  // The registry reaches the cells through context rather than a default. Without it a
  // host that replaced a question type would find its replacement everywhere except
  // inside a table, which is the one place the difference is hardest to spot.
  await expect.element(screen.getByTestId('host-cell').first()).toHaveTextContent('Pens Quantity');
});
