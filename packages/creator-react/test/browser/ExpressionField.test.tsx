/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import { PropertyGridPanel } from '@kajay/creator-react';
import { userEvent } from '@vitest/browser/context';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** The expression editor and the translations editor — checklist L2. */
const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'age' },
        { type: 'text', name: 'agent' },
        { type: 'text', name: 'who', title: 'Your name' },
      ],
    },
  ],
};

function surface(definition: SurveyDefinition = BASIC, select = 'who'): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  const designed = new DesignSurface({ definition, registry });
  const chosen = designed.survey.getQuestionByName(select);
  if (chosen !== undefined) {
    designed.select(chosen);
  }
  return designed;
}

function property(designed: DesignSurface, name: string): unknown {
  return designed.survey.getQuestionByName('who')?.getPropertyValue(name);
}

test('parity/L2-expression: nothing is offered until something is typed', async () => {
  const designed = surface();
  const screen = await render(<PropertyGridPanel surface={designed} />);
  const field = screen.getByTestId('property-who-visibleIf');

  await expect.element(field).toHaveAttribute('role', 'combobox');
  await expect.element(field).toHaveAttribute('aria-expanded', 'false');
  expect(screen.container.querySelectorAll('[role="option"]')).toHaveLength(0);
});

test('parity/L2-expression: a brace offers the survey’s own questions', async () => {
  const designed = surface();
  const screen = await render(<PropertyGridPanel surface={designed} />);

  await screen.getByTestId('property-who-visibleIf').fill('{ag');

  const options = [...screen.container.querySelectorAll('[role="option"]')].map(
    (option) => option.textContent,
  );
  // Matched on the start of the name, and `who` is left out because it is the question
  // being edited — a `visibleIf` referring to itself is a cycle.
  expect(options).toEqual(['age', 'agent']);
  await expect.element(screen.getByTestId('property-who-visibleIf')).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});

test('parity/L2-expression: the arrows walk and Enter accepts', async () => {
  const designed = surface();
  const screen = await render(<PropertyGridPanel surface={designed} />);
  const field = screen.getByTestId('property-who-visibleIf');
  await field.fill('{ag');

  await userEvent.keyboard('{ArrowDown}');
  await userEvent.keyboard('{Enter}');

  // Focus never moved: the input keeps it and `aria-activedescendant` said which option
  // was current, which is the whole of the combobox pattern.
  expect(property(designed, 'visibleIf')).toBe('{agent}');
  await expect.element(field).toHaveValue('{agent}');
});

test('parity/L2-expression: Escape closes without accepting', async () => {
  const designed = surface();
  const screen = await render(<PropertyGridPanel surface={designed} />);
  const field = screen.getByTestId('property-who-visibleIf');
  await field.fill('{ag');

  await userEvent.keyboard('{Escape}');

  // A designer who did not want a suggestion must be able to say so without losing what
  // they typed.
  expect(screen.container.querySelectorAll('[role="option"]')).toHaveLength(0);
  await expect.element(field).toHaveValue('{ag');
  expect(property(designed, 'visibleIf')).toBe('{ag');
});

test('parity/L2-expression: a bare word offers functions and never references', async () => {
  const designed = surface();
  const screen = await render(<PropertyGridPanel surface={designed} />);

  await screen.getByTestId('property-who-visibleIf').fill('ii');

  const options = [...screen.container.querySelectorAll('[role="option"]')].map(
    (option) => option.textContent,
  );
  expect(options).toEqual(['iif()']);
});

test('parity/L2-expression: a plain string property has no suggestions at all', async () => {
  const designed = surface();
  const screen = await render(<PropertyGridPanel surface={designed} />);

  await expect.element(screen.getByTestId('property-who-title')).not.toHaveAttribute('role');
});

test('parity/L2-translations: a language is written without touching the others', async () => {
  const designed = surface({
    locale: 'fr',
    pages: [
      {
        name: 'p1',
        elements: [{ type: 'text', name: 'who', title: { default: 'Name', fr: 'Nom' } }],
      },
    ],
  });
  const screen = await render(<PropertyGridPanel surface={designed} />);

  await screen.getByTestId('translations-title').click();
  await expect.element(screen.getByTestId('translation-title-default')).toHaveValue('Name');
  await screen.getByTestId('translation-title-fr').fill('Nom complet');

  expect(property(designed, 'title')).toEqual({ default: 'Name', fr: 'Nom complet' });
});

test('parity/L2-translations: a language nobody has used yet can be added', async () => {
  const designed = surface();
  const screen = await render(<PropertyGridPanel surface={designed} />);
  await screen.getByTestId('translations-title').click();
  // A value that was never translated *is* the default language, which is what makes
  // adding a second one a matter of typing in the field beside it.
  await expect.element(screen.getByTestId('translation-title-default')).toHaveValue('Your name');

  await screen.getByTestId('add-locale-title').fill('de');
  await screen.getByTestId('add-locale-button-title').click();

  // A field, not a translation: `{ de: "" }` in a definition is something an author
  // wrote, and pressing Add is not writing it.
  expect(property(designed, 'title')).toBe('Your name');
  await screen.getByTestId('translation-title-de').fill('Ihr Name');
  expect(property(designed, 'title')).toEqual({ default: 'Your name', de: 'Ihr Name' });
});

test('parity/L2-translations: a property that is not localizable has none', async () => {
  const designed = surface();
  const screen = await render(<PropertyGridPanel surface={designed} />);

  expect(screen.container.querySelector('[data-testid="translations-visibleIf"]')).toBeNull();
});
