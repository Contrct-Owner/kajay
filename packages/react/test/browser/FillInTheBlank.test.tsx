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
              { type: 'text', name: 'capital', title: 'Capital city' },
              { type: 'text', name: 'currency', title: 'Currency' },
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
    blanks: [{ type: 'text', name: 'capital', title: 'Capital city' }, { name: 'unused', label: 'Unused' }],
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

test('parity/C13-render: a dropdown blank draws a real select inside the sentence', async () => {
  const survey = build({
    template: 'The capital of France is [[capital]].',
    blanks: [
      { type: 'dropdown', name: 'capital', title: 'Capital city', choices: ['Paris', 'Lyon'] },
    ],
  });
  const screen = await render(<Survey model={survey} />);

  // The whole point of the reframe: a gap is a *question*, so a dropdown blank is a
  // dropdown and its choices came from the select family rather than from anything
  // reimplemented inside a private item type.
  const select = screen.container.querySelector('select');
  expect(select).not.toBeNull();
  expect([...(select?.options ?? [])].map((option) => option.text)).toEqual(['', 'Paris', 'Lyon']);
  await expect.element(screen.getByLabelText('Capital city')).toBeInTheDocument();
});

test('parity/C13-render: choosing from a dropdown blank records that blank', async () => {
  const survey = build({
    template: 'The capital of France is [[capital]].',
    blanks: [
      { type: 'dropdown', name: 'capital', title: 'Capital city', choices: ['Paris', 'Lyon'] },
    ],
  });
  const screen = await render(<Survey model={survey} />);

  await screen.getByLabelText('Capital city').selectOptions('Paris');

  expect(survey.data['geography']).toEqual({ capital: 'Paris' });
});

test('parity/C13-render: a multi-select blank stores an array under its key', async () => {
  const survey = build({
    template: 'Its cities include [[cities]].',
    blanks: [
      { type: 'tagbox', name: 'cities', title: 'Cities', choices: ['Paris', 'Lyon', 'Nice'] },
    ],
  });
  const screen = await render(<Survey model={survey} />);

  // A disclosure and real checkboxes, not a `<select multiple>`: the browser draws that
  // one's list itself, with glyphs no theme can reach — the only gap in a sentence whose
  // contents were nobody's to style.
  await screen.getByLabelText('Cities').click();
  await screen.getByLabelText('Paris').click();
  await screen.getByLabelText('Nice').click();

  // The answer shape already allowed this: one object keyed by blank name, and a
  // multi-select blank simply stores an array under its key.
  expect(survey.data['geography']).toEqual({ cities: ['Paris', 'Nice'] });
});

test('parity/C13-render: a sentence mixes field kinds in the author’s order', async () => {
  const survey = build({
    template: 'The capital is [[capital]], and it is [[nice]].',
    blanks: [
      { type: 'dropdown', name: 'capital', title: 'Capital city', choices: ['Paris'] },
      { type: 'boolean', name: 'nice', title: 'Nice place' },
    ],
  });
  const screen = await render(<Survey model={survey} />);

  const controls = [...screen.container.querySelectorAll('select, input')];
  // A form authored by writing a sentence — which is what the type is actually for.
  expect(controls.map((node) => node.tagName)).toEqual(['SELECT', 'INPUT']);
});

test('parity/C13-axe: an inline control is named without printing its title', async () => {
  const survey = build({
    template: 'The capital is [[capital]].',
    blanks: [
      { type: 'dropdown', name: 'capital', title: 'Capital city', choices: ['Paris'] },
    ],
  });
  const screen = await render(<Survey model={survey} />);

  // The sentence labels the gap on the page; only the accessibility tree needs it said
  // again, and saying it visibly would print it inside the prose that already did.
  const question = screen.container.querySelector('[data-question-name="geography"]');
  expect(question?.textContent).not.toContain('Capital city');
  await expect.element(screen.getByLabelText('Capital city')).toBeInTheDocument();
});

test('parity/C13-render: a computed gap states its value in the sentence', async () => {
  const survey = build({
    template: 'We have [[seats]] seats, which is [[annual]] a year.',
    blanks: [
      { type: 'text', name: 'seats', title: 'Seats' },
      { type: 'expression', name: 'annual', title: 'Yearly', expression: '{geography.seats} * 12' },
    ],
  });
  const screen = await render(<Survey model={survey} />);

  await screen.getByLabelText('Seats').fill('5');

  // Read-only and computed, so the sentence states a total mid-clause without offering a
  // control nobody can use — and it recomputes because a blank's rule is in the graph.
  await expect.element(screen.getByText('60')).toBeInTheDocument();
});

test('parity/C13-render: a gap is drawn from the same parts as the control on its own line', async () => {
  const survey = build({
    template: 'I work in [[dept]] and it is [[remote]] that I am remote.',
    blanks: [
      {
        type: 'dropdown',
        name: 'dept',
        title: 'Department',
        placeholder: 'a department',
        choices: ['Engineering', 'Design'],
      },
      { type: 'boolean', name: 'remote', title: 'Remote' },
    ],
  });
  const screen = await render(<Survey model={survey} />);

  // The same class the block dropdown wears, because it is the same control. Wearing a
  // text input's class instead, it took a text input's styling from every host that had
  // styled one — the sentence's dropdown looked like a box that could be typed into.
  const select = screen.container.querySelector('select');
  expect(select?.className).toContain('kajay-question__select');

  // A yes/no gap is the switch, not a bare checkbox: the same primitive and the same
  // class as the block renderer, so a design system's toggle reaches a sentence too.
  const toggle = screen.container.querySelector('.kajay-boolean__switch');
  expect(toggle).not.toBeNull();
});

test('parity/C13-render: a prompt is not one of the choices', async () => {
  const survey = build({
    template: 'I work in [[dept]].',
    blanks: [
      {
        type: 'dropdown',
        name: 'dept',
        title: 'Department',
        placeholder: 'a department',
        choices: ['Engineering', 'Design'],
      },
    ],
  });
  const screen = await render(<Survey model={survey} />);

  // Visible in the list, "a department" sat between Engineering and Design and read as a
  // department of that name. Hidden, it is still what the closed control says — which is
  // the whole of the role a placeholder plays.
  const select = screen.container.querySelector('select');
  const prompt = select?.querySelector('option[value=""][hidden]');
  expect(prompt?.textContent).toBe('a department');

  // And the way back to no answer survives, because this blank is not required: a native
  // select has no undo, so a respondent who picks by mistake needs a row to pick.
  const rows = [...(select?.options ?? [])].filter((option) => !option.hidden);
  expect(rows.map((option) => option.textContent)).toEqual(['', 'Engineering', 'Design']);
});

test('parity/C13-render: a chosen value keeps the type the author gave it', async () => {
  const survey = build({
    template: 'I rate it [[score]].',
    blanks: [
      { type: 'dropdown', name: 'score', title: 'Score', choices: [1, 2, 3] },
    ],
  });
  const screen = await render(<Survey model={survey} />);

  const select = screen.container.querySelector('select');
  select!.value = '2';
  select!.dispatchEvent(new Event('change', { bubbles: true }));

  // A native option carries a string. Read straight off the element — which is what the
  // inline renderer used to do — a choice authored as `2` came back as `"2"`, and the
  // response differed from the same question asked on a line of its own.
  expect(survey.data).toEqual({ geography: { score: 2 } });
});

test('parity/C13-axe: a multi-select gap says what it is and whether it is open', async () => {
  const survey = build({
    template: 'Its cities include [[cities]].',
    blanks: [
      { type: 'tagbox', name: 'cities', title: 'Cities', choices: ['Paris', 'Lyon'] },
    ],
  });
  const screen = await render(<Survey model={survey} />);

  // A disclosure, which is the whole of the contract: a button that names the gap and
  // says whether its choices are showing. Not a listbox — that is a roving-focus widget
  // and ADR-0022 keeps that kind of interaction out of this adapter.
  const button = screen.container.querySelector('.kajay-fillintheblank__multi button');
  expect(button?.getAttribute('aria-expanded')).toBe('false');
  expect(button?.getAttribute('aria-label')).toBe('Cities');

  await screen.getByLabelText('Cities').click();

  expect(button?.getAttribute('aria-expanded')).toBe('true');
  const menu = screen.container.querySelector('.kajay-fillintheblank__menu');
  expect(menu?.getAttribute('role')).toBe('group');
  expect(menu?.getAttribute('aria-label')).toBe('Cities');
});

test('parity/C13-render: what a multi-select gap says is what was chosen', async () => {
  const survey = build({
    template: 'Its cities include [[cities]].',
    blanks: [
      {
        type: 'tagbox',
        name: 'cities',
        title: 'Cities',
        placeholder: 'some cities',
        choices: ['Paris', 'Lyon'],
      },
    ],
  });
  const screen = await render(<Survey model={survey} />);
  const button = screen.container.querySelector('.kajay-fillintheblank__multi button');

  // Empty, it prompts. Answered, it reads back in the author's own words, because the
  // sentence now says something and "2 selected" would make a reader open it to find out.
  expect(button?.textContent).toBe('some cities');

  await screen.getByLabelText('Cities').click();
  await screen.getByLabelText('Lyon').click();

  expect(button?.textContent).toBe('Lyon');
});

