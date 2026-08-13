/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * A sentence with gaps in a real DOM — checklist C13.
 *
 * What no unit test can see is the whole point of the type: whether the inputs land
 * *inside* the prose rather than after it, and whether each one is named to a screen
 * reader. The sentence labels a gap on the page and not in the accessibility tree, so a
 * naive implementation reads as "edit text, blank" twice — correct in the model, useless
 * to the respondent who most needs the sentence read aloud.
 */
function build(overrides: Readonly<Record<string, unknown>> = {}): SurveyModel {
  return parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'fillintheblank',
            name: 'geography',
            title: 'Complete the sentence',
            template: 'The capital of France is [[capital]] and its currency is the [[currency]].',
            blanks: [
              { name: 'capital', label: 'Capital city' },
              { name: 'currency', label: 'Currency' },
            ],
            ...overrides,
          },
        ],
      },
    ],
  }).survey;
}

test('parity/C13-render: the gaps are drawn inside the sentence, in order', async () => {
  const survey = build();
  const screen = await render(<Survey model={survey} />);

  const question = screen.container.querySelector('[data-question-name="geography"]');
  // The prose and the inputs interleave, which is what makes this a type rather than a
  // label above a row of boxes. Reading the text content back is the only way to say the
  // words and the gaps are in the author's order.
  const parts = [...(question?.querySelectorAll('span, input') ?? [])];
  const shape = parts
    .filter((node) => node.tagName === 'INPUT' || node.classList.length === 0)
    .map((node) => (node.tagName === 'INPUT' ? '[gap]' : node.textContent));
  expect(shape.join('')).toBe(
    'The capital of France is [gap] and its currency is the [gap].',
  );
});

test('parity/C13-axe: every gap is named to a screen reader', async () => {
  const survey = build();
  const screen = await render(<Survey model={survey} />);

  // By label, which is how an assistive technology finds it — and how a respondent using
  // one tells the two gaps apart. Without the hidden labels both are "blank".
  await expect.element(screen.getByLabelText('Capital city')).toBeInTheDocument();
  await expect.element(screen.getByLabelText('Currency')).toBeInTheDocument();
});

test('parity/C13-axe: the name needs no stylesheet to stay out of the sentence', async () => {
  const survey = build();
  const screen = await render(<Survey model={survey} />);

  // This suite loads no stylesheet, which is exactly the condition that matters: a host
  // may decline `@kajay/themes`. A rendered-then-hidden label would print "Capital city"
  // inside the prose here; an `aria-label` names the input and adds no text at all.
  const question = screen.container.querySelector('[data-question-name="geography"]');
  expect(question?.textContent).not.toContain('Capital city');
  expect(screen.container.querySelectorAll('label')).toHaveLength(0);
});

test('parity/C13-render: typing into a gap records that gap', async () => {
  const survey = build();
  const screen = await render(<Survey model={survey} />);

  await screen.getByLabelText('Capital city').fill('Paris');

  // One object keyed by blank name, so the answer says which gap it came from.
  expect(survey.data['geography']).toEqual({ capital: 'Paris' });
});

test('parity/C13-render: a blank the template never names is not drawn', async () => {
  const survey = build({
    template: 'Only [[capital]] appears.',
    blanks: [{ name: 'capital', label: 'Capital city' }, { name: 'unused', label: 'Unused' }],
  });
  const screen = await render(<Survey model={survey} />);

  // Declared and never positioned. The definition diagnostic reports it to the author;
  // drawing it anyway would put an input in a sentence that does not mention it.
  expect(screen.container.querySelectorAll('input')).toHaveLength(1);
});

test('parity/C13-render: an unsupported box is never drawn for a registered type', async () => {
  const survey = build();
  const screen = await render(<Survey model={survey} />);

  expect(screen.container.querySelectorAll('.kajay-question--unsupported')).toHaveLength(0);
});
