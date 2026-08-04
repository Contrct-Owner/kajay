/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface, TranslationSession } from '@kajay/creator-core';
import type { TranslationRequest } from '@kajay/creator-core';
import { TranslationsPanel } from '@kajay/creator-react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** The translation editor — checklist M4. */
const BASIC: SurveyDefinition = {
  title: { default: 'A survey', fr: 'Un sondage' },
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        { type: 'radiogroup', name: 'tier', title: 'Which tier?', choices: ['bronze'] },
      ],
    },
  ],
};

function surface(): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition: BASIC, registry });
}

test('parity/M4-translations: a column per language, over every string', async () => {
  const designed = surface();
  const session = new TranslationSession(designed);
  const screen = await render(<TranslationsPanel session={session} />);

  await expect.element(screen.getByTestId('translations-column-default')).toBeInTheDocument();
  await expect.element(screen.getByTestId('translations-column-fr')).toBeInTheDocument();
  // A cell is named by **both** headers it sits under. The language alone would give every
  // cell in a column the same name, which is what a translator working down one hears.
  await expect.element(screen.getByLabelText('Your name › title in fr')).toBeInTheDocument();
  await expect
    .element(screen.getByTestId('translation-cell-survey/title-fr'))
    .toHaveValue('Un sondage');
  session.dispose();
});

test('parity/M4-translations: typing in a cell writes that language and no other', async () => {
  const designed = surface();
  const session = new TranslationSession(designed);
  const screen = await render(<TranslationsPanel session={session} />);

  await screen.getByTestId('translation-cell-survey/pages/p1/elements/who/title-fr').fill('Votre nom');

  expect(designed.survey.getQuestionByName('who')?.getPropertyValue('title')).toEqual({
    default: 'Your name',
    fr: 'Votre nom',
  });
  session.dispose();
});

test('parity/M4-translation-columns: adding a language opens a column only', async () => {
  const designed = surface();
  const session = new TranslationSession(designed);
  const screen = await render(<TranslationsPanel session={session} />);

  await screen.getByLabelText('Language to add').fill('de');
  await screen.getByTestId('add-locale-button').click();

  await expect.element(screen.getByTestId('translations-column-de')).toBeInTheDocument();
  // Not a hundred empty translations nobody authored.
  expect(JSON.stringify(designed.definition)).not.toContain('"de"');
  session.dispose();
});

test('parity/M4-translations: the table follows the designer', async () => {
  const designed = surface();
  const session = new TranslationSession(designed);
  const screen = await render(<TranslationsPanel session={session} />);

  designed.setProperty(designed.survey.getQuestionByName('who')!, 'title', 'Renamed');

  // Derived, never stored — there is no second list of strings to fall out of step.
  await expect
    .element(screen.getByTestId('translation-cell-survey/pages/p1/elements/who/title-default'))
    .toHaveValue('Renamed');
  session.dispose();
});

test('parity/M4-machine-translation: it fills the empty cells and says how many', async () => {
  const designed = surface();
  const session = new TranslationSession(designed, {
    translate: (request: TranslationRequest) =>
      Promise.resolve(request.texts.map((text) => `${text} [${request.to}]`)),
  });
  const screen = await render(<TranslationsPanel session={session} />);

  await screen.getByTestId('translate-button').click();

  await expect.element(screen.getByTestId('translations-report')).toHaveTextContent(/Filled \d+/u);
  await expect
    .element(screen.getByTestId('translation-cell-survey/pages/p1/elements/who/title-fr'))
    .toHaveValue('Your name [fr]');
  // Never over the top of what a person wrote.
  await expect
    .element(screen.getByTestId('translation-cell-survey/title-fr'))
    .toHaveValue('Un sondage');
  session.dispose();
});

test('parity/M4-machine-translation: a refusal is reported rather than swallowed', async () => {
  const designed = surface();
  const session = new TranslationSession(designed, {
    translate: () => Promise.reject(new Error('quota exceeded')),
  });
  const screen = await render(<TranslationsPanel session={session} />);

  await screen.getByTestId('translate-button').click();

  await expect.element(screen.getByTestId('translations-report')).toHaveTextContent('quota exceeded');
  session.dispose();
});
