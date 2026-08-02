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

test('an answer typed in the browser survives serialization', async () => {
  const model = buildModel();
  const screen = await render(<Survey model={model} />);

  await screen.getByLabelText(/What is your name\?/u).fill('Ada');

  // The definition is unaffected by answers: data and definition are separate.
  const canonical = serializeSurvey(model);
  expect(JSON.stringify(canonical)).not.toContain('Ada');
  expect(model.data).toEqual({ fullName: 'Ada' });
});
