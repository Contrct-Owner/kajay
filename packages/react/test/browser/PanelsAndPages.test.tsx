/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

function build(definition: Readonly<Record<string, unknown>>): SurveyModel {
  return parseSurvey(definition).survey;
}

test('parity/E1-panels: a panel groups its questions and nests', async () => {
  const model = build({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'panel',
            name: 'contact',
            title: 'Contact details',
            elements: [
              { type: 'text', name: 'email', title: 'Email' },
              {
                type: 'panel',
                name: 'address',
                title: 'Address',
                elements: [{ type: 'text', name: 'street', title: 'Street' }],
              },
            ],
          },
        ],
      },
    ],
  });

  const screen = await render(<Survey model={model} />);

  await expect.element(screen.getByRole('group', { name: 'Contact details' })).toBeVisible();
  await expect.element(screen.getByRole('group', { name: 'Address' })).toBeVisible();
  await expect.element(screen.getByLabelText('Street')).toBeVisible();

  await screen.getByLabelText('Street').fill('5 Ada Way');
  expect(model.data).toEqual({ street: '5 Ada Way' });
});

test('parity/E1-panel-visibility: a panel hides its whole subtree', async () => {
  const model = build({
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'gate', title: 'Gate' },
          {
            type: 'panel',
            name: 'extras',
            title: 'Extras',
            visibleIf: '{gate} notempty',
            elements: [{ type: 'text', name: 'inside', title: 'Inside' }],
          },
        ],
      },
    ],
  });

  const screen = await render(<Survey model={model} />);

  await expect.element(screen.getByLabelText('Inside')).not.toBeInTheDocument();
  await screen.getByLabelText('Gate').fill('open');
  await expect.element(screen.getByLabelText('Inside')).toBeVisible();
});

test('parity/E1-panel-enable: enableIf on a panel freezes everything inside it', async () => {
  const model = build({
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'gate', title: 'Gate' },
          {
            type: 'panel',
            name: 'extras',
            title: 'Extras',
            enableIf: '{gate} notempty',
            elements: [{ type: 'text', name: 'inside', title: 'Inside' }],
          },
        ],
      },
    ],
  });

  const screen = await render(<Survey model={model} />);

  // The fieldset does the work: no walk over children, and it is what a screen reader
  // reports too.
  await expect.element(screen.getByLabelText('Inside')).toBeDisabled();
  await screen.getByLabelText('Gate').fill('open');
  await expect.element(screen.getByLabelText('Inside')).toBeEnabled();
});

test('parity/E1-panel-collapse: an authored state makes a panel collapsible', async () => {
  const model = build({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'panel',
            name: 'section',
            title: 'Optional extras',
            state: 'collapsed',
            elements: [{ type: 'text', name: 'inside', title: 'Inside' }],
          },
          {
            type: 'panel',
            name: 'plain',
            title: 'Always open',
            elements: [{ type: 'text', name: 'always', title: 'Always' }],
          },
        ],
      },
    ],
  });

  const screen = await render(<Survey model={model} />);

  const toggle = screen.getByRole('button', { name: 'Optional extras' });
  await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect.element(screen.getByLabelText('Inside')).not.toBeInTheDocument();

  await toggle.click();
  await expect.element(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect.element(screen.getByLabelText('Inside')).toBeVisible();

  // A panel with no authored state is a grouping device, not a disclosure widget.
  await expect.element(screen.getByRole('button', { name: 'Always open' })).not.toBeInTheDocument();
  await expect.element(screen.getByLabelText('Always')).toBeVisible();
});

test('parity/E2-navigation: pages are walked one at a time', async () => {
  const model = build({
    pages: [
      { name: 'one', title: 'First', elements: [{ type: 'text', name: 'a', title: 'A' }] },
      { name: 'two', title: 'Second', elements: [{ type: 'text', name: 'b', title: 'B' }] },
    ],
  });

  const screen = await render(<Survey model={model} />);

  await expect.element(screen.getByLabelText('A')).toBeVisible();
  await expect.element(screen.getByLabelText('B')).not.toBeInTheDocument();
  await expect.element(screen.getByTestId('page-position')).toHaveTextContent('Page 1 of 2');
  // Nothing to go back to yet.
  await expect.element(screen.getByRole('button', { name: 'Previous' })).not.toBeInTheDocument();

  await screen.getByRole('button', { name: 'Next' }).click();
  await expect.element(screen.getByLabelText('B')).toBeVisible();
  await expect.element(screen.getByLabelText('A')).not.toBeInTheDocument();
  await expect.element(screen.getByTestId('page-position')).toHaveTextContent('Page 2 of 2');

  await screen.getByRole('button', { name: 'Previous' }).click();
  await expect.element(screen.getByLabelText('A')).toBeVisible();
});

test('parity/E2-navigation: the primary button completes on the last page', async () => {
  const model = build({
    pages: [
      { name: 'one', elements: [{ type: 'text', name: 'a', title: 'A' }] },
      { name: 'two', elements: [{ type: 'text', name: 'b', title: 'B' }] },
    ],
  });

  const screen = await render(<Survey model={model} />);
  await screen.getByRole('button', { name: 'Next' }).click();
  await screen.getByRole('button', { name: 'Complete' }).click();

  expect(model.isCompleted).toBe(true);
  await expect.element(screen.getByRole('status')).toBeVisible();
});

test('parity/E2-page-visibility: a page appearing changes the count as you answer', async () => {
  const model = build({
    pages: [
      { name: 'one', elements: [{ type: 'text', name: 'gate', title: 'Gate' }] },
      {
        name: 'two',
        visibleIf: '{gate} notempty',
        elements: [{ type: 'text', name: 'b', title: 'B' }],
      },
    ],
  });

  const screen = await render(<Survey model={model} />);

  // One page, so no position indicator and the primary button already completes.
  await expect.element(screen.getByTestId('page-position')).not.toBeInTheDocument();
  await expect.element(screen.getByRole('button', { name: 'Complete' })).toBeVisible();

  await screen.getByLabelText('Gate').fill('yes');
  await expect.element(screen.getByTestId('page-position')).toHaveTextContent('Page 1 of 2');
  await expect.element(screen.getByRole('button', { name: 'Next' })).toBeVisible();
});

test('parity/E2-questions-on-page-mode: singlePage shows everything at once', async () => {
  const model = build({
    questionsOnPageMode: 'singlePage',
    pages: [
      { name: 'one', elements: [{ type: 'text', name: 'a', title: 'A' }] },
      { name: 'two', elements: [{ type: 'text', name: 'b', title: 'B' }] },
    ],
  });

  const screen = await render(<Survey model={model} />);

  await expect.element(screen.getByLabelText('A')).toBeVisible();
  await expect.element(screen.getByLabelText('B')).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Complete' })).toBeVisible();
});

test('parity/E2-questions-on-page-mode: questionPerPage shows exactly one', async () => {
  const model = build({
    questionsOnPageMode: 'questionPerPage',
    pages: [
      {
        name: 'one',
        elements: [
          { type: 'text', name: 'a', title: 'A' },
          { type: 'text', name: 'b', title: 'B' },
        ],
      },
    ],
  });

  const screen = await render(<Survey model={model} />);

  await expect.element(screen.getByTestId('page-position')).toHaveTextContent('Page 1 of 2');
  await expect.element(screen.getByLabelText('B')).not.toBeInTheDocument();

  await screen.getByRole('button', { name: 'Next' }).click();
  await expect.element(screen.getByLabelText('B')).toBeVisible();
});
