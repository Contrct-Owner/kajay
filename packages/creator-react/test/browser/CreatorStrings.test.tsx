/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { CreatorStringDictionary, Toolbox } from '@kajay/creator-core';
import { CreatorStringsProvider, SurveyCreator, ToolboxPanel } from '@kajay/creator-react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** White-labelling — checklist N3. */
const BASIC: SurveyDefinition = {
  pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who', title: 'Your name' }] }],
};

function registry(): MetadataRegistry {
  const made = new MetadataRegistry();
  registerBuiltInTypes(made);
  return made;
}

test('parity/N3-strings: a Creator with no dictionary speaks English and works', async () => {
  const screen = await render(<SurveyCreator value={BASIC} registry={registry()} />);

  // A piece rendered with no provider gets English, which is what keeps the pieces usable
  // alone (ADR-0021).
  await expect.element(screen.getByTestId('creator-tab-design')).toHaveTextContent('Design');
  await expect.element(screen.getByTestId('undo')).toHaveTextContent('Undo');
});

test('parity/N3-strings: a host renames the Creator’s own words', async () => {
  const strings = new CreatorStringDictionary();
  // White labelling is renaming, not translating: same language, different vocabulary.
  strings.register('en', { tabDesign: 'Build', undo: 'Step back', toolboxSearch: 'Find a field' });

  const screen = await render(
    <SurveyCreator value={BASIC} registry={registry()} strings={strings} />,
  );

  await expect.element(screen.getByTestId('creator-tab-design')).toHaveTextContent('Build');
  await expect.element(screen.getByTestId('undo')).toHaveTextContent('Step back');
  await expect.element(screen.getByLabelText('Find a field')).toBeInTheDocument();
  // Registering merges rather than replaces, so the other eighty are untouched.
  await expect.element(screen.getByTestId('creator-tab-json')).toHaveTextContent('JSON');
});

test('parity/N3-strings: a language reaches every panel, not only the chrome', async () => {
  const strings = new CreatorStringDictionary();
  strings.register('fr', {
    tabLogic: 'Logique',
    logicEmpty: 'Aucune logique.',
    sectionGeneral: 'Général',
    categoryText: 'Texte',
  });

  const screen = await render(
    <SurveyCreator value={BASIC} registry={registry()} strings={strings} locale="fr" />,
  );

  // The toolbox category and the grid section are the Creator's words too — K1 and L1 both
  // said they would stay English until this row.
  await expect.element(screen.getByText('Texte')).toBeInTheDocument();
  await screen.getByTestId('select-who').click();
  await expect.element(screen.getByText('Général')).toBeInTheDocument();

  await screen.getByTestId('creator-tab-logic').click();
  await expect.element(screen.getByText('Aucune logique.')).toBeInTheDocument();
});

test('parity/N3-strings: an untranslated key still says something', async () => {
  const strings = new CreatorStringDictionary();
  strings.register('fr', { tabDesign: 'Conception' });

  const screen = await render(
    <SurveyCreator value={BASIC} registry={registry()} strings={strings} locale="fr" />,
  );

  // An untranslated button with no label is worse in every language than one labelled in
  // the wrong one.
  await expect.element(screen.getByTestId('creator-tab-design')).toHaveTextContent('Conception');
  await expect.element(screen.getByTestId('creator-tab-theme')).toHaveTextContent('Theme');
});

test('parity/N3-strings: a host’s own drawer keeps the name the host gave it', async () => {
  const toolbox = new Toolbox({ registry: registry() });
  toolbox.add({ type: 'text', name: 'bespoke-field', title: 'Our field', category: 'Bespoke' });
  const strings = new CreatorStringDictionary();
  strings.register('en', { categoryText: 'Written answers' });

  const screen = await render(
    <CreatorStringsProvider dictionary={strings}>
      <ToolboxPanel toolbox={toolbox} />
    </CreatorStringsProvider>,
  );

  // A *fallback*, not a lookup. K1's drawers are localizable; a drawer the catalogue has
  // never heard of keeps its own word, or §L4's "name your own section" and this row would
  // contradict each other.
  await expect.element(screen.getByText('Written answers')).toBeInTheDocument();
  await expect.element(screen.getByText('Bespoke')).toBeInTheDocument();
});

test('parity/N3-theme: the Creator’s own chrome is themed apart from the survey', async () => {
  const screen = await render(
    <SurveyCreator
      value={BASIC}
      registry={registry()}
      creatorTheme={{ '--kajay-color-accent': 'rgb(1, 2, 3)' }}
    />,
  );

  // An agency's tool is their brand and their client's survey is the client's, so a
  // white-labelled Creator cannot be forced to look like what it edits.
  const root = screen.container.querySelector('.kajay-creator') as HTMLElement;
  expect(root.style.getPropertyValue('--kajay-color-accent')).toBe('rgb(1, 2, 3)');
});
