/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * Detail panels and the narrow-screen layout — checklist F4 and F6.
 *
 * Both are entirely about what reaches the DOM: whether a detail can be opened with a
 * keyboard and says so, and whether a table stops being a table when there is no room
 * for one. Neither is visible from the model, and the suite runs at a stated desktop
 * viewport (see vitest.config.ts) so a test about a table is not quietly a test about a
 * list.
 */
function build(overrides: Readonly<Record<string, unknown>> = {}): SurveyModel {
  return parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'matrixdynamic',
            name: 'expenses',
            title: 'Your expenses',
            rowTitleFormat: 'Line {0}',
            minRowCount: 2,
            columns: [{ type: 'text', name: 'amount', title: 'Amount', inputType: 'number' }],
            detailElements: [
              { type: 'comment', name: 'reason', title: 'What was it for?', isRequired: true },
            ],
            detailPanelMode: 'underRow',
            ...overrides,
          },
        ],
      },
    ],
  }).survey;
}

test('parity/F4-detail-panels: a row opens onto its own questions', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  const toggle = screen.getByRole('button', { name: 'Line 1' });
  // The control says what it owns and what state it is in, rather than being a chevron
  // a sighted mouse user can guess at.
  await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect
    .element(screen.getByRole('textbox', { name: 'Line 1 What was it for?' }))
    .not.toBeInTheDocument();

  await toggle.click();

  await expect.element(toggle).toHaveAttribute('aria-expanded', 'true');
  const detail = screen.getByRole('textbox', { name: 'Line 1 What was it for?' });
  await detail.fill('Taxi to the airport');

  // Straight into the row it belongs to, beside the columns.
  expect(model.data).toEqual({ expenses: [{ reason: 'Taxi to the airport' }] });
});

test('parity/F4-detail-panels: a detail with an error opens itself', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('button', { name: 'Complete' }).click();

  // The respondent has just been told the page is wrong; the field at fault was behind
  // a closed panel, and a message they cannot see is one they cannot act on.
  await expect
    .element(screen.getByRole('textbox', { name: 'Line 1 What was it for?' }))
    .toBeInTheDocument();
});

test('parity/F4-detail-panels: underRowSingle keeps one open', async () => {
  const screen = await render(<Survey model={build({ detailPanelMode: 'underRowSingle' })} />);

  await screen.getByRole('button', { name: 'Line 1' }).click();
  await screen.getByRole('button', { name: 'Line 2' }).click();

  await expect
    .element(screen.getByRole('button', { name: 'Line 1' }))
    .toHaveAttribute('aria-expanded', 'false');
  await expect
    .element(screen.getByRole('button', { name: 'Line 2' }))
    .toHaveAttribute('aria-expanded', 'true');
});

test('parity/F6-mobile-mode: a list is rows of groups, not a table', async () => {
  const model = build({ mobileMode: 'list', detailPanelMode: 'none', detailElements: [] });
  const screen = await render(<Survey model={model} />);

  // No table at all — a structural change rather than a class name, because this
  // library ships no stylesheet and a hook nobody styles is a feature nobody can see.
  await expect.element(screen.getByRole('table')).not.toBeInTheDocument();

  const row = screen.getByRole('group', { name: 'Line 1' });
  await expect.element(row).toBeInTheDocument();

  // The cell keeps the label it already had: a title naming the row *and* the column
  // reads correctly under a legend and behind a column header alike.
  await screen.getByRole('spinbutton', { name: 'Line 1 Amount' }).fill('12');
  expect(model.data).toEqual({ expenses: [{ amount: 12 }] });
});

test('parity/F6-mobile-mode: table is a table, whatever the screen', async () => {
  const screen = await render(
    <Survey model={build({ mobileMode: 'table', detailPanelMode: 'none', detailElements: [] })} />,
  );

  await expect.element(screen.getByRole('table')).toBeInTheDocument();
});

test('parity/F6-mobile-mode: a list still adds and removes rows', async () => {
  const model = build({ mobileMode: 'list', detailPanelMode: 'none', detailElements: [] });
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('spinbutton', { name: 'Line 1 Amount' }).fill('12');
  await screen.getByRole('button', { name: 'Add row' }).click();
  await screen.getByRole('spinbutton', { name: 'Line 3 Amount' }).fill('30');

  expect(model.data).toEqual({ expenses: [{ amount: 12 }, {}, { amount: 30 }] });

  await screen.getByRole('button', { name: 'Remove' }).first().click();
  expect(model.data).toEqual({ expenses: [{}, { amount: 30 }] });
});
