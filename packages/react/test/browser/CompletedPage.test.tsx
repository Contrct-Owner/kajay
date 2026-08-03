/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey, useSurveyStatus } from '@kajay/react';
import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * A host using the state hook on its own — its own spinner, its own empty message.
 *
 * Rendered without `<Survey>` on purpose. Inside it, the state is also re-read because
 * the survey subscribes to the logic channel for its own reasons, so a hook that
 * watched the wrong channel would still look correct there. This is the only place its
 * contract is actually visible.
 */
function StateProbe({ model }: { readonly model: SurveyModel }): ReactElement {
  return <p data-testid="probe">{useSurveyStatus(model)}</p>;
}

/**
 * The end of a survey in a real DOM.
 *
 * The model decides what the ending *says*; only a browser can show that it is rendered
 * as markup rather than escaped, that a respondent's answer inside it is escaped rather
 * than rendered, and that anyone not looking at that part of the page is told.
 */
function build(extra: Readonly<Record<string, unknown>> = {}): SurveyModel {
  return parseSurvey({
    ...extra,
    pages: [{ name: 'p1', elements: [{ type: 'text', name: 'name', title: 'Name' }] }],
  }).survey;
}

test('parity/E5-completed-html: the ending is the author’s markup, rendered as markup', async () => {
  const model = build({ completedHtml: '<p>All done, <strong>thank you</strong>.</p>' });
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('button', { name: 'Complete' }).click();

  // An element, not four characters: rendering the markup is the feature.
  await expect.element(screen.getByText('thank you')).toBeInTheDocument();
  const status = screen.getByRole('status');
  await expect.element(status).toHaveTextContent('All done, thank you.');
});

test('parity/E5-completed-html: an answer inside the ending is escaped, not rendered', async () => {
  const model = build({ completedHtml: '<p>Thanks, {name}.</p>' });
  const screen = await render(<Survey model={model} />);

  await screen.getByLabelText('Name').fill('<img src=x onerror="alert(1)">');
  await screen.getByRole('button', { name: 'Complete' }).click();

  const status = screen.getByRole('status');
  // Read back as text — so it reached the DOM as text. An `<img>` here would be an
  // injection every survey that greets someone by name would ship with.
  await expect.element(status).toHaveTextContent('Thanks, <img src=x onerror="alert(1)">.');
  expect(status.element().querySelector('img')).toBeNull();
});

test('parity/E5-completed-html: with nothing authored the renderer still says something', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('button', { name: 'Complete' }).click();
  await expect.element(screen.getByRole('status')).toHaveTextContent('Thank you');
});

test('parity/E5-survey-state: a survey with nothing to answer says so', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        visibleIf: '{ready} = true',
        elements: [{ type: 'text', name: 'name', title: 'Name' }],
      },
    ],
  }).survey;
  const screen = await render(<Survey model={model} />);

  // Not an empty form with a Next button under it.
  await expect.element(screen.getByRole('status')).toHaveTextContent('no questions');
  expect(screen.container.querySelector('form')).toBeNull();
});

test('parity/E5-survey-state: a survey that empties itself mid-answer says so', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        visibleIf: '{stage} <> \'done\'',
        elements: [
          {
            type: 'radiogroup',
            name: 'stage',
            title: 'Stage',
            choices: ['open', 'done'],
          },
        ],
      },
    ],
  }).survey;
  const screen = await render(<Survey model={model} />);
  // A single-select group is a `radiogroup`, which is both more accurate and what
  // makes `aria-readonly` legal on it (K3's sweep found the old `group` shipping).
  await expect.element(screen.getByRole('radiogroup', { name: 'Stage' })).toBeInTheDocument();

  // The answer hides the page holding it. Emptying is announced on the logic channel
  // rather than the state one, so a renderer watching only for completion would sit
  // there drawing a form with nothing on it.
  await screen.getByLabelText('done').click();
  await expect.element(screen.getByRole('status')).toHaveTextContent('no questions');
});

test('parity/E5-survey-state: the loading state is the host’s to set, and is announced', async () => {
  const model = build({ loadingHtml: '<p>Fetching your answers…</p>' });
  const screen = await render(<Survey model={model} />);
  await expect.element(screen.getByLabelText('Name')).toBeInTheDocument();

  model.status.setLoading(true);
  await expect.element(screen.getByRole('status')).toHaveTextContent('Fetching your answers');

  model.status.setLoading(false);
  // And back to the form, because loading is a state the survey passes through rather
  // than a door it closes behind itself.
  await expect.element(screen.getByLabelText('Name')).toBeInTheDocument();
});

test('parity/E5-survey-state: the state hook stands on its own', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        visibleIf: '{stage} <> \'done\'',
        elements: [{ type: 'text', name: 'stage' }],
      },
    ],
  }).survey;
  const screen = await render(<StateProbe model={model} />);
  await expect.element(screen.getByTestId('probe')).toHaveTextContent('running');

  // Emptying is announced on the logic channel and completion on the state one. A hook
  // that subscribed to either alone would go quiet for half of what it reports.
  model.setValue('stage', 'done');
  await expect.element(screen.getByTestId('probe')).toHaveTextContent('empty');

  model.status.setLoading(true);
  await expect.element(screen.getByTestId('probe')).toHaveTextContent('loading');
});
