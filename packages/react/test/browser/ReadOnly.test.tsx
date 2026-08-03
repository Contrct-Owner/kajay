/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * Reading a survey rather than answering it, in a real DOM.
 *
 * The model says *whether* a question is read-only; only a browser can show that the
 * answer is still there to be read, still reachable by keyboard, and genuinely refuses
 * to change — three things `disabled` would have got wrong in three different ways.
 */
function build(extra: Readonly<Record<string, unknown>> = {}): SurveyModel {
  return parseSurvey({
    ...extra,
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'name', title: 'Name' },
          {
            type: 'radiogroup',
            name: 'plan',
            title: 'Plan',
            choices: ['free', 'paid'],
          },
          {
            type: 'dropdown',
            name: 'region',
            title: 'Region',
            placeholder: 'Choose a region',
            choices: ['Europe', 'Americas'],
          },
        ],
      },
    ],
  }).survey;
}

test('parity/E7-read-only: a text answer is readable and not editable', async () => {
  const model = build({ readOnly: true });
  model.setValue('name', 'Ada');
  const screen = await render(<Survey model={model} />);

  const field = screen.getByLabelText('Name');
  await expect.element(field).toHaveValue('Ada');
  await expect.element(field).toHaveAttribute('readonly');
  // Not disabled: it keeps its place in the tab order, so someone reviewing what they
  // submitted can actually reach it.
  await expect.element(field).toBeEnabled();
});

test('parity/E7-read-only: a choice refuses the click without leaving the page', async () => {
  const model = build({ readOnly: true });
  model.setValue('plan', 'free');
  const screen = await render(<Survey model={model} />);

  await screen.getByLabelText('paid').click();

  // The activation is cancelled, so nothing changed — and the radio is still focusable
  // and still announced, which is what `aria-readonly` tells a screen reader to expect.
  //
  // On the **radiogroup**, not on a `group`: a bare `<fieldset>` maps to `group`, which
  // does not support the attribute, and this assertion used to pin that invalid markup
  // in place. K3's accessibility sweep caught it.
  expect(model.data['plan']).toBe('free');
  await expect.element(screen.getByLabelText('free')).toBeChecked();
  await expect
    .element(screen.getByRole('radiogroup', { name: /Plan/u }))
    .toHaveAttribute('aria-readonly', 'true');
});

test('parity/E7-read-only: a dropdown offers only what was chosen', async () => {
  const model = build({ readOnly: true });
  model.setValue('region', 'Europe');
  const screen = await render(<Survey model={model} />);

  const field = screen.getByLabelText('Region');
  // A native select has no readonly state, so the list itself is reduced to the answer:
  // genuinely unchangeable rather than merely refusing, and still focusable, which
  // `disabled` would not be.
  await expect.element(field).toHaveValue('Europe');
  expect(field.element().querySelectorAll('option')).toHaveLength(1);
});

test('parity/E7-read-only: one question can be read-only in a live survey', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'price', title: 'Price', inputType: 'number' },
          {
            type: 'text',
            name: 'annual',
            title: 'Annual',
            readOnly: true,
            defaultValueExpression: '{price} * 12',
          },
        ],
      },
    ],
  }).survey;
  const screen = await render(<Survey model={model} />);

  await screen.getByLabelText('Price').fill('10');

  // The respondent may not type into it and the engine may: that combination is the
  // whole reason a read-only answer is worth having.
  await expect.element(screen.getByLabelText('Annual')).toHaveValue('120');
  await expect.element(screen.getByLabelText('Annual')).toHaveAttribute('readonly');
  await expect.element(screen.getByLabelText('Price')).not.toHaveAttribute('readonly');
});

test('parity/E7-read-only: a host can flip the whole survey while it is on screen', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);
  await expect.element(screen.getByLabelText('Name')).not.toHaveAttribute('readonly');

  model.setReadOnly(true);

  // Announced on the state channel the renderer already watches — without that, the
  // page would go on accepting answers the model no longer believes in.
  await expect.element(screen.getByLabelText('Name')).toHaveAttribute('readonly');
});

test('parity/E7-read-only: the state is announced on a role that carries it', async () => {
  // The rule ARIA actually imposes, pinned per question type. `aria-readonly` is
  // defined on `radiogroup`, `checkbox`, `switch` and `combobox`, and *not* on `group`
  // — which is what a `<fieldset>` maps to. Five renderers put it on one until K3's
  // accessibility sweep looked at a read-only survey for the first time.
  const model = parseSurvey({
    readOnly: true,
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'radiogroup', name: 'tier', title: 'Tier', choices: ['a', 'b'] },
          { type: 'checkbox', name: 'topics', title: 'Topics', choices: ['x', 'y'] },
          { type: 'boolean', name: 'agreed', title: 'Agreed' },
          {
            type: 'ranking',
            name: 'order',
            title: 'Order',
            choices: ['first', 'second'],
          },
        ],
      },
    ],
  }).survey;
  const screen = await render(<Survey model={model} />);
  const container = screen.container;

  // A single-select group is a radiogroup, and says it there.
  const tier = container.querySelector('[data-question-name="tier"]');
  expect(tier?.getAttribute('role')).toBe('radiogroup');
  expect(tier?.getAttribute('aria-readonly')).toBe('true');

  // A multi-select group is a plain `group`, so each checkbox says it instead.
  const topics = container.querySelector('[data-question-name="topics"]');
  expect(topics?.getAttribute('aria-readonly')).toBeNull();
  expect(topics?.querySelector('input[type=checkbox]')?.getAttribute('aria-readonly')).toBe('true');

  // A switch is a checkbox to ARIA and carries it itself.
  const agreed = container.querySelector('[data-question-name="agreed"]');
  expect(agreed?.getAttribute('aria-readonly')).toBeNull();
  expect(agreed?.querySelector('input')?.getAttribute('aria-readonly')).toBe('true');

  // A ranking row is a button: no value, so no read-only state exists for it.
  // `aria-disabled` is what can be said, and it keeps the row focusable.
  const order = container.querySelector('[data-question-name="order"]');
  expect(order?.getAttribute('aria-readonly')).toBeNull();
  const row = order?.querySelector('.kajay-ranking__row');
  expect(row?.getAttribute('aria-disabled')).toBe('true');
  expect(row?.hasAttribute('disabled')).toBe(false);
});
