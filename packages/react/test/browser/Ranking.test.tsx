/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import { userEvent } from 'vitest/browser';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * Reordering in a real DOM.
 *
 * None of this is observable from the model: whether a row can be reached by keyboard
 * at all, whether focus travels with it, and whether anything is said about it are
 * exactly the parts a unit test cannot see — and exactly the parts that decide whether
 * a ranking is answerable without a mouse.
 */
function build(extra: Readonly<Record<string, unknown>> = {}): SurveyModel {
  return parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'ranking',
            name: 'priorities',
            title: 'Priorities',
            choices: [
              { value: 'speed', text: 'Speed' },
              { value: 'price', text: 'Price' },
              { value: 'support', text: 'Support' },
            ],
            ...extra,
          },
        ],
      },
    ],
  }).survey;
}

test('parity/C9-keyboard-reorder: a row is picked up, moved and dropped with the keyboard', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('button', { name: /Speed/u }).click();
  await userEvent.keyboard(' ');
  await userEvent.keyboard('{ArrowDown}');
  await userEvent.keyboard(' ');

  expect(model.data).toEqual({ priorities: ['price', 'speed', 'support'] });
  // Focus went with the row rather than staying at position one, or the next arrow
  // key would move whatever had taken its place.
  await expect.element(screen.getByRole('button', { name: /Speed/u })).toHaveFocus();
});

test('parity/C9-keyboard-reorder: every move is announced with its new position', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('button', { name: /Support/u }).click();
  await userEvent.keyboard(' ');
  await expect
    .element(screen.getByText(/Support grabbed, position 3 of 3/u))
    .toBeInTheDocument();

  await userEvent.keyboard('{ArrowUp}');
  // The position and the total, not "moved up": a respondent who cannot see the list
  // needs where it is now, not what they just did.
  await expect.element(screen.getByText('Support, position 2 of 3.')).toBeInTheDocument();
});

test('parity/C9-keyboard-reorder: escape puts a grabbed row back where it started', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('button', { name: /Speed/u }).click();
  await userEvent.keyboard(' ');
  await userEvent.keyboard('{ArrowDown}');
  await userEvent.keyboard('{ArrowDown}');
  expect(model.data).toEqual({ priorities: ['price', 'support', 'speed'] });

  await userEvent.keyboard('{Escape}');
  expect(model.data).toEqual({ priorities: ['speed', 'price', 'support'] });
  await expect
    .element(screen.getByText(/Speed returned to position 1 of 3/u))
    .toBeInTheDocument();
});

test('parity/C9-keyboard-reorder: the arrows walk the list while nothing is held', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('button', { name: /Speed/u }).click();
  await userEvent.keyboard('{ArrowDown}');

  await expect.element(screen.getByRole('button', { name: /Price/u })).toHaveFocus();
  // Nothing was grabbed, so walking the list is all that happened.
  expect(model.data).toEqual({});
});

test('parity/C9-ranking: a row says what it is and how to move it', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);
  const row = screen.getByRole('button', { name: /Speed/u });

  // "Sortable item" rather than "button": pressing it does not do something, it picks
  // something up, and the instructions for that are its description.
  await expect.element(row).toHaveAttribute('aria-roledescription', 'Sortable item');
  await expect
    .element(screen.getByText(/Press space to pick this up/u))
    .toBeInTheDocument();
  // Suffix, not the whole id: P7 gave each rendered survey its own prefix, and pinning the
  // literal would pin the prefix — which is generated and none of this test's business.
  // What matters is that the row points at *its own* hint.
  expect(row.element().getAttribute('aria-describedby')).toContain(
    'kajay-question-priorities-ranked-hint',
  );
});

test('parity/C9-select-to-rank: choices move between the pool and the ranking', async () => {
  const model = build({ selectToRankEnabled: true });
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('button', { name: 'Rank Support' }).click();
  await screen.getByRole('button', { name: 'Rank Speed' }).click();
  expect(model.data).toEqual({ priorities: ['support', 'speed'] });

  await screen.getByRole('button', { name: 'Remove Support from the ranking' }).click();
  expect(model.data).toEqual({ priorities: ['speed'] });
  // Back among the choices, in the order the author wrote them.
  await expect.element(screen.getByRole('button', { name: 'Rank Support' })).toBeInTheDocument();
});
