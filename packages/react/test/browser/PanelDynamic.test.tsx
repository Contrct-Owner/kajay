/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * A repeating panel in a real DOM — checklist G1, G2 and G4.
 *
 * What only a browser shows: that an instance is a group a screen reader can announce as
 * one, that the questions inside it are drawn by their own renderers, that moving between
 * instances actually changes what is on screen, and that a matrix nested in a template
 * draws cells rather than an empty table.
 */
function build(overrides: Readonly<Record<string, unknown>> = {}): SurveyModel {
  return parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'paneldynamic',
            name: 'people',
            title: 'Who is travelling?',
            panelTitleFormat: 'Traveller {0}',
            addPanelText: 'Add a traveller',
            templateElements: [
              { type: 'text', name: 'fullName', title: 'Name' },
              { type: 'text', name: 'age', title: 'Age', inputType: 'number' },
              {
                type: 'text',
                name: 'guardian',
                title: 'Responsible adult',
                visibleIf: '{panel.age} < 18',
              },
            ],
            ...overrides,
          },
        ],
      },
    ],
  }).survey;
}

test('parity/G1-paneldynamic: an instance is a group of its own questions', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  const first = screen.getByRole('group', { name: 'Traveller 1' });
  await expect.element(first).toBeInTheDocument();

  await screen.getByRole('textbox', { name: 'Traveller 1 Name' }).fill('Ada');
  await screen.getByRole('button', { name: 'Add a traveller' }).click();
  await screen.getByRole('textbox', { name: 'Traveller 2 Name' }).fill('Grace');

  expect(model.data).toEqual({ people: [{ fullName: 'Ada' }, { fullName: 'Grace' }] });
});

test('parity/G3-panel-scope: a condition inside an instance is about that instance', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('button', { name: 'Add a traveller' }).click();
  await screen.getByRole('spinbutton', { name: 'Traveller 2 Age' }).fill('12');

  await expect
    .element(screen.getByRole('textbox', { name: 'Traveller 2 Responsible adult' }))
    .toBeInTheDocument();
  await expect
    .element(screen.getByRole('textbox', { name: 'Traveller 1 Responsible adult' }))
    .not.toBeInTheDocument();
});

test('parity/G1-paneldynamic: removing an instance keeps the others', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('textbox', { name: 'Traveller 1 Name' }).fill('Ada');
  await screen.getByRole('button', { name: 'Add a traveller' }).click();
  await screen.getByRole('textbox', { name: 'Traveller 2 Name' }).fill('Grace');

  await screen.getByRole('button', { name: 'Remove' }).first().click();

  expect(model.data).toEqual({ people: [{ fullName: 'Grace' }] });
  await expect
    .element(screen.getByRole('textbox', { name: 'Traveller 1 Name' }))
    .toHaveValue('Grace');
});

test('parity/G2-render-modes: a paged panel shows one at a time', async () => {
  const model = build({ renderMode: 'progress', minPanelCount: 2 });
  const screen = await render(<Survey model={model} />);

  await expect.element(screen.getByText('1 of 2')).toBeInTheDocument();
  await expect
    .element(screen.getByRole('textbox', { name: 'Traveller 2 Name' }))
    .not.toBeInTheDocument();

  await screen.getByRole('button', { name: 'Next' }).click();

  await expect
    .element(screen.getByRole('textbox', { name: 'Traveller 2 Name' }))
    .toBeInTheDocument();
  // The survey's own Next is a different control on the same page, so the panel's says
  // where it is rather than borrowing the page's meaning.
  await expect.element(screen.getByText('2 of 2')).toBeInTheDocument();
});

test('parity/G2-render-modes: tabs move between instances', async () => {
  const model = build({ renderMode: 'tab', minPanelCount: 2 });
  const screen = await render(<Survey model={model} />);

  const second = screen.getByRole('tab', { name: 'Traveller 2' });
  await expect.element(second).toHaveAttribute('aria-selected', 'false');

  await second.click();

  await expect.element(second).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(screen.getByRole('textbox', { name: 'Traveller 2 Name' }))
    .toBeInTheDocument();
});

test('parity/G2-render-modes: adding moves to what was added', async () => {
  const model = build({ renderMode: 'progress' });
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('button', { name: 'Add a traveller' }).click();

  // Not left behind on the first: a control that adds something out of sight appears to
  // do nothing.
  await expect.element(screen.getByText('2 of 2')).toBeInTheDocument();
});

test('parity/G4-nested-composites: a matrix inside a template draws its cells', async () => {
  const model = build({
    templateElements: [
      { type: 'text', name: 'fullName', title: 'Name' },
      {
        type: 'panel',
        name: 'baggage',
        title: 'Baggage',
        elements: [
          {
            type: 'matrixdynamic',
            name: 'bags',
            title: 'Bags',
            minRowCount: 1,
            columns: [{ type: 'text', name: 'weight', title: 'Weight', inputType: 'number' }],
          },
        ],
      },
    ],
  });
  const screen = await render(<Survey model={model} />);

  // A group inside a group, and a table inside that — none of which needed a feature:
  // a template is a list of page elements, so each is drawn by whatever draws it
  // anywhere else.
  await expect.element(screen.getByRole('group', { name: 'Baggage' })).toBeInTheDocument();
  await screen.getByRole('spinbutton', { name: /Weight/u }).first().fill('23');

  expect(model.data).toEqual({ people: [{ bags: [{ weight: 23 }] }] });
});
