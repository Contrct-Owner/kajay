/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** Two surveys on one page keep their ids apart — checklist P7. */
const DEFINITION: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        { type: 'comment', name: 'why', title: 'Why?' },
      ],
    },
  ],
};

function surveyModel() {
  return parseSurvey(DEFINITION).survey;
}

test('parity/P7-id-scope: one definition rendered twice produces no duplicate ids', async () => {
  const screen = await render(
    <>
      <Survey model={surveyModel()} />
      <Survey model={surveyModel()} />
    </>,
  );

  await expect.element(screen.getByText('Your name').first()).toBeInTheDocument();

  const ids = [...screen.container.querySelectorAll('[id]')].map((node) => node.id);
  // The defect this row exists for. Before the scope, both surveys emitted
  // `kajay-question-who` and the document was invalid — which is not a style complaint:
  // `label[for]` resolves to the first match, so the second survey's labels pointed at the
  // first survey's inputs.
  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);
});

test('parity/P7-id-scope: each survey’s label points at its own input', async () => {
  const screen = await render(
    <>
      <Survey model={surveyModel()} />
      <Survey model={surveyModel()} />
    </>,
  );

  const labels = [...screen.container.querySelectorAll('label')].filter(
    (label) => label.textContent === 'Your name',
  );
  expect(labels).toHaveLength(2);

  for (const label of labels) {
    const target = screen.container.querySelector(`#${CSS.escape(label.htmlFor)}`);
    // Inside the *same* survey as its label. A screen reader on the second survey used to
    // be handed the first one's control, which is the difference between a nuisance and an
    // accessibility defect.
    expect(label.closest('.kajay-theme')?.contains(target ?? null)).toBe(true);
  }
});

test('parity/P7-id-scope: one survey alone still reads the way it always did', async () => {
  const screen = await render(<Survey model={surveyModel()} />);

  const input = await screen.getByLabelText('Your name').element();
  // The prefix is generated, so the shape is what can be asserted — and the suffix is the
  // part anything downstream recognises.
  expect(input.id).toContain('kajay-question-who');
  expect(input.id.endsWith('kajay-question-who')).toBe(true);
});
