/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import { PropertyGridPanel } from '@kajay/creator-react';
import { userEvent } from 'vitest/browser';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** The property grid — checklist L1. */
const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        { type: 'comment', name: 'why', title: 'Why?', visibleIf: '{who} notempty' },
      ],
    },
  ],
};

function surface(): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition: BASIC, registry });
}

function select(designed: DesignSurface, name: string): DesignSurface {
  const element = designed.page?.elements.find((candidate) => candidate.name === name);
  if (element !== undefined) {
    designed.select(element);
  }
  return designed;
}

function property(designed: DesignSurface, element: string, name: string): unknown {
  return designed.survey.getQuestionByName(element)?.getPropertyValue(name);
}

test('parity/L1-grid: nothing is drawn until something is selected', async () => {
  const designed = surface();
  const screen = await render(<PropertyGridPanel surface={designed} />);

  await expect
    .element(screen.getByText('Select a question or a page to edit it.'))
    .toBeInTheDocument();

  select(designed, 'who');
  await expect.element(screen.getByTestId('properties-who-General')).toBeInTheDocument();
});

test('parity/L1-grid: the sections and their rows come from the registry', async () => {
  const designed = select(surface(), 'who');
  const screen = await render(<PropertyGridPanel surface={designed} />);

  // A text question's own property, an inherited one, and an expression that landed in
  // Logic because the registry says it is one — none of them named anywhere in the panel.
  await expect.element(screen.getByLabelText('Input type', { exact: true })).toHaveValue('text');
  await expect.element(screen.getByLabelText('Title', { exact: true })).toHaveValue('Your name');
  await expect.element(screen.getByTestId('properties-who-Logic')).toBeInTheDocument();
  expect(
    screen.container.querySelectorAll('.kajay-properties__section:not(.kajay-collection)'),
  ).toHaveLength(5);
});

test('parity/L1-grid: the registry’s description is wired to its field', async () => {
  const designed = select(surface(), 'who');
  const screen = await render(<PropertyGridPanel surface={designed} />);

  const field = screen.getByLabelText('Visible if', { exact: true }).element();
  const hint = field.getAttribute('aria-describedby');

  // A hint only sighted users get is the same hint being missing — and these sentences
  // are what says which values an enumerated string property accepts.
  expect(hint).not.toBeNull();
  expect(screen.container.querySelector(`#${hint ?? ''}`)?.textContent).toContain('Expression');
});

test('parity/L1-grid: a row with an explanation says so, and keeps it either way', async () => {
  const designed = select(surface(), 'who');
  const screen = await render(<PropertyGridPanel surface={designed} />);
  const row = screen.container.querySelector<HTMLElement>('[data-property="visibleIf"]')!;

  // The explanations are no longer permanently on screen — a panel whose every field
  // carried a line of prose was mostly prose. What replaces them is a marker, and *not* a
  // control: whether the words are visible is a question for the stylesheet, while the
  // words themselves never leave the accessibility tree, because the field still points at
  // them. That is the claim worth pinning here; that the stylesheet hides and reveals them
  // is the playground's, where there is a stylesheet.
  expect(row.querySelector('.kajay-properties__mark')).not.toBeNull();
  expect(row.querySelector('.kajay-properties__mark')?.getAttribute('aria-hidden')).toBe('true');
  expect(row.querySelector('.kajay-properties__mark')?.closest('label')).toBeNull();
  expect(row.querySelector('.kajay-properties__hint')?.textContent).toContain('Expression');
});

test('parity/L1-grid: a row with nothing to explain draws no marker', async () => {
  const designed = select(surface(), 'who');
  const screen = await render(<PropertyGridPanel surface={designed} />);
  const row = screen.container.querySelector<HTMLElement>('[data-property="placeholder"]')!;

  // A marker promising an explanation that does not exist is worse than no marker: it is
  // an affordance that does nothing, on the one control in the panel where nothing is what
  // the designer would be expecting.
  expect(row.querySelector('.kajay-properties__hint')).toBeNull();
  expect(row.querySelector('.kajay-properties__mark')).toBeNull();
});

test('parity/L1-editors: a checkbox writes a boolean, and shows the one it wrote', async () => {
  const designed = select(surface(), 'who');
  const screen = await render(<PropertyGridPanel surface={designed} />);
  const required = screen.getByLabelText('Is required', { exact: true });

  await required.click();

  expect(property(designed, 'who', 'isRequired')).toBe(true);
  // Asserted as well as written: a checkbox that ignores the value in force reads
  // correctly on the way in and is wrong the moment anything else changes it.
  await expect.element(required).toBeChecked();
});

test('parity/L1-editors: typing in a text field reaches the survey as it is typed', async () => {
  const designed = select(surface(), 'who');
  const screen = await render(<PropertyGridPanel surface={designed} />);

  await screen.getByLabelText('Placeholder', { exact: true }).fill('Family name');

  expect(property(designed, 'who', 'placeholder')).toBe('Family name');
});

test('parity/L1-editors: clearing a number field leaves it cleared', async () => {
  // A comment's `rows`, because a text question's only number property is `step` — which
  // §L3 hides unless the input type is numeric.
  const designed = select(surface(), 'why');
  const screen = await render(<PropertyGridPanel surface={designed} />);
  const rows = screen.getByLabelText('Rows', { exact: true });
  await rows.fill('3');

  await rows.fill('');

  // A field driven straight from the model would write 4 the instant it was cleared and
  // put it straight back on screen, which is a number editor that cannot be cleared.
  await expect.element(rows).toHaveValue('');
  expect(property(designed, 'why', 'rows')).toBe(3);
});

test('parity/L1-editors: unparseable JSON is flagged and not written', async () => {
  const designed = select(surface(), 'who');
  const screen = await render(<PropertyGridPanel surface={designed} />);
  const field = screen.getByLabelText('Correct answer', { exact: true });

  await field.fill('{"a":');

  await expect.element(field).toHaveAttribute('aria-invalid', 'true');
  expect(property(designed, 'who', 'correctAnswer')).toBeUndefined();

  await field.fill('{"a":1}');
  await expect.element(field).not.toHaveAttribute('aria-invalid');
  expect(property(designed, 'who', 'correctAnswer')).toEqual({ a: 1 });
});

test('parity/L1-rename: the name commits on blur, not on every keystroke', async () => {
  const designed = select(surface(), 'who');
  const screen = await render(<PropertyGridPanel surface={designed} />);

  await screen.getByLabelText('Name', { exact: true }).fill('applicant');

  // Committing per keystroke would rename through `a`, `ap`, `app`… — a series of
  // renames of names that never existed, each one re-parsing the survey underneath the
  // field being typed in and each one its own entry on the undo stack.
  expect(designed.survey.getQuestionByName('who')).toBeDefined();

  await userEvent.tab();
  expect(designed.survey.getQuestionByName('applicant')).toBeDefined();
  expect(property(designed, 'why', 'visibleIf')).toBe('{applicant} notempty');
});

test('parity/L1-rename: a refused name puts the old one back in the field', async () => {
  const designed = select(surface(), 'who');
  const screen = await render(<PropertyGridPanel surface={designed} />);
  const field = screen.getByLabelText('Name', { exact: true });

  await field.fill('why');
  await userEvent.tab();

  // Two questions answering to one name is exactly what `getQuestionByName` cannot
  // survive. Leaving the refused name on screen would say it had been accepted.
  await expect.element(field).toHaveValue('who');
  expect(designed.survey.getQuestionByName('who')).toBeDefined();
});

test('parity/L1-grid: an undo puts the field back', async () => {
  const designed = select(surface(), 'who');
  const screen = await render(<PropertyGridPanel surface={designed} />);
  const field = screen.getByLabelText('Title', { exact: true });
  await field.fill('Renamed');

  designed.undo();

  // The draft is re-seeded when the value changes *underneath* the field and not when it
  // changes because of it, which is the whole reason the field holds one.
  await expect.element(field).toHaveValue('Your name');
});

test('parity/L1-grid: selecting a page shows the page’s own properties', async () => {
  const designed = surface();
  const page = designed.pages[0];
  if (page !== undefined) {
    designed.select(page);
  }
  const screen = await render(<PropertyGridPanel surface={designed} />);

  // Nothing in the panel knows what a page is. It is a registered class like any other.
  await expect.element(screen.getByLabelText('Name', { exact: true })).toHaveValue('p1');
  await expect.element(screen.getByLabelText('Max time to finish', { exact: true })).toBeInTheDocument();
});

test('parity/K5-convert: the type picker changes the question in place', async () => {
  const designed = select(surface(), 'who');
  const screen = await render(<PropertyGridPanel surface={designed} />);

  await screen.getByLabelText('Type of who').selectOptions('comment');

  // The same question under a different renderer, carrying everything the new type also
  // declares. What it has no place for is dropped, and P6 says so.
  expect(designed.survey.getQuestionByName('who')?.type).toBe('comment');
});

test('parity/P11-type: the picker is in the grid, above the name', async () => {
  const designed = select(surface(), 'who');
  const screen = await render(<PropertyGridPanel surface={designed} />);

  // It sat inline in the adorner on every selected element, which it had not earned:
  // converting is rare, the rendered question already says what type it is, and it was the
  // only lossy edit on the canvas permanently under the cursor. Above `name` because the
  // type is the more fundamental fact — it decides which properties exist at all.
  await expect.element(screen.getByLabelText('Type of who')).toHaveValue('text');

  const rows = [...screen.container.querySelectorAll<HTMLElement>('[data-property]')];
  expect(rows[0]?.dataset['property']).toBe('type');
});
