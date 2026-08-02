/// <reference types="@vitest/browser/matchers" />
import { parseSurvey, serializeSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * Rendering integration, in real Chromium, through the public package API only —
 * exactly the boundary a host uses. jsdom is banned repo-wide; DOM behaviour is proven
 * here or not at all.
 */
function buildModel(): SurveyModel {
  return parseSurvey({
    title: 'Rendering integration',
    pages: [
      {
        name: 'p1',
        title: 'About you',
        elements: [
          { type: 'text', name: 'fullName', title: 'What is your name?', isRequired: true },
          { type: 'text', name: 'email', title: 'Email', inputType: 'email' },
        ],
      },
    ],
  }).survey;
}

test('renders the survey title, page and questions from the model', async () => {
  const screen = await render(<Survey model={buildModel()} />);

  await expect.element(screen.getByRole('heading', { name: 'Rendering integration' })).toBeVisible();
  await expect.element(screen.getByRole('heading', { name: 'About you' })).toBeVisible();
  await expect.element(screen.getByLabelText(/What is your name\?/u)).toBeVisible();
  await expect.element(screen.getByLabelText('Email')).toBeVisible();
});

test('maps inputType onto the rendered input type', async () => {
  const screen = await render(<Survey model={buildModel()} />);
  await expect.element(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
});

test('marks a required question for assistive technology', async () => {
  const screen = await render(<Survey model={buildModel()} />);
  await expect
    .element(screen.getByLabelText(/What is your name\?/u))
    .toHaveAttribute('aria-required', 'true');
});

test('typing pushes the value into the model', async () => {
  const model = buildModel();
  const screen = await render(<Survey model={model} />);

  await screen.getByLabelText(/What is your name\?/u).fill('Ada Lovelace');

  expect(model.data).toEqual({ fullName: 'Ada Lovelace' });
});

test('a model change made outside React re-renders the input', async () => {
  const model = buildModel();
  const screen = await render(<Survey model={model} />);

  model.setValue('email', 'ada@example.com');

  await expect.element(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
});

test('submitting completes the survey and swaps in the completed view', async () => {
  const model = buildModel();
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('button', { name: 'Complete' }).click();

  expect(model.isCompleted).toBe(true);
  await expect.element(screen.getByRole('status')).toBeVisible();
});

test('parity/B3-visible-if: a hidden question appears once its condition holds', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'fullName', title: 'Your name' },
          { type: 'text', name: 'nickname', title: 'Preferred name', visibleIf: '{fullName} notempty' },
        ],
      },
    ],
  }).survey;

  const screen = await render(<Survey model={model} />);

  // Not merely hidden with CSS — absent from the DOM entirely.
  await expect.element(screen.getByLabelText('Preferred name')).not.toBeInTheDocument();

  await screen.getByLabelText('Your name').fill('Ada Lovelace');
  await expect.element(screen.getByLabelText('Preferred name')).toBeVisible();

  await screen.getByLabelText('Your name').fill('');
  await expect.element(screen.getByLabelText('Preferred name')).not.toBeInTheDocument();
});

test('parity/B4-enable-if: a disabled question is present but not editable', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'gate', title: 'Gate' },
          { type: 'text', name: 'locked', title: 'Locked', enableIf: '{gate} notempty' },
        ],
      },
    ],
  }).survey;

  const screen = await render(<Survey model={model} />);

  // Unlike visibleIf, the element stays in the DOM — it is frozen, not removed.
  await expect.element(screen.getByLabelText('Locked')).toBeDisabled();
  await screen.getByLabelText('Gate').fill('open');
  await expect.element(screen.getByLabelText('Locked')).toBeEnabled();
});

test('parity/B4-required-if: requiredness follows the condition', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'gate', title: 'Gate' },
          { type: 'text', name: 'maybe', title: 'Maybe', requiredIf: "{gate} == 'yes'" },
        ],
      },
    ],
  }).survey;

  const screen = await render(<Survey model={model} />);

  await expect.element(screen.getByLabelText('Maybe')).toHaveAttribute('aria-required', 'false');
  await screen.getByLabelText('Gate').fill('yes');
  await expect.element(screen.getByLabelText('Maybe')).toHaveAttribute('aria-required', 'true');
});

test('parity/C3-radiogroup: picking a choice records it', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'radiogroup', name: 'size', title: 'Size', choices: ['small', 'large'] },
        ],
      },
    ],
  }).survey;

  const screen = await render(<Survey model={model} />);

  await screen.getByLabelText('large').click();
  expect(model.data).toEqual({ size: 'large' });
  await expect.element(screen.getByLabelText('large')).toBeChecked();
});

test('parity/C4-checkbox: multiple choices accumulate', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'checkbox', name: 'toppings', title: 'Toppings', choices: ['cheese', 'ham'] },
        ],
      },
    ],
  }).survey;

  const screen = await render(<Survey model={model} />);

  await screen.getByLabelText('cheese').click();
  await screen.getByLabelText('ham').click();
  expect(model.data).toEqual({ toppings: ['cheese', 'ham'] });
});

test('parity/B3-visible-if: a choice appears once its own condition holds', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'gate', title: 'Gate' },
          {
            type: 'radiogroup',
            name: 'pick',
            title: 'Pick',
            choices: ['always', { value: 'sometimes', visibleIf: "{gate} == 'yes'" }],
          },
        ],
      },
    ],
  }).survey;

  const screen = await render(<Survey model={model} />);

  await expect.element(screen.getByLabelText('sometimes')).not.toBeInTheDocument();
  await screen.getByLabelText('Gate').fill('yes');
  await expect.element(screen.getByLabelText('sometimes')).toBeVisible();
});

test('parity/C5-dropdown: choosing an option records it', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'dropdown',
            name: 'plan',
            title: 'Plan',
            placeholder: 'Choose a plan',
            choices: ['free', 'paid'],
          },
        ],
      },
    ],
  }).survey;

  const screen = await render(<Survey model={model} />);

  await screen.getByLabelText('Plan').selectOptions('paid');
  expect(model.data).toEqual({ plan: 'paid' });
});

test('parity/C6-tagbox: several options accumulate', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'tagbox', name: 'langs', title: 'Languages', choices: ['ts', 'go', 'rust'] },
        ],
      },
    ],
  }).survey;

  const screen = await render(<Survey model={model} />);

  await screen.getByLabelText('Languages').selectOptions(['ts', 'rust']);
  expect(model.data).toEqual({ langs: ['ts', 'rust'] });
});

test('a non-string answer written by logic is displayed, not blanked', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'gate', title: 'Gate' },
          {
            type: 'text',
            name: 'count',
            title: 'Count',
            setValueIf: '{gate} notempty',
            setValueExpression: '0',
          },
        ],
      },
    ],
  }).survey;

  const screen = await render(<Survey model={model} />);
  await screen.getByLabelText('Gate').fill('go');

  // Zero is an answer. Rendering only strings blanked it.
  await expect.element(screen.getByLabelText('Count')).toHaveValue('0');
});

test('an answer typed in the browser survives serialization', async () => {
  const model = buildModel();
  const screen = await render(<Survey model={model} />);

  await screen.getByLabelText(/What is your name\?/u).fill('Ada');

  // The definition is unaffected by answers: data and definition are separate.
  const canonical = serializeSurvey(model);
  expect(JSON.stringify(canonical)).not.toContain('Ada');
  expect(model.data).toEqual({ fullName: 'Ada' });
});
