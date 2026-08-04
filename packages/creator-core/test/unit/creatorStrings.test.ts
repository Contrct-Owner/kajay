import { describe, expect, test } from 'vitest';
import { CreatorStringDictionary } from '../../src/CreatorStringDictionary.js';
import {
  CREATOR_STRING_DEFINITIONS,
  EN_CREATOR_STRINGS,
  formatCreatorString,
} from '../../src/creatorStrings.js';

/** The Creator's own words — checklist N3. */
describe('parity/N3-strings', () => {
  test('English cannot be missing an entry, because the entry is the English', () => {
    // The catalogue is the source of its own key union, so this is a fact about the build
    // rather than a claim in a document.
    for (const definition of CREATOR_STRING_DEFINITIONS) {
      expect(EN_CREATOR_STRINGS[definition.key]).toBe(definition.en);
    }
    expect(Object.keys(EN_CREATOR_STRINGS)).toHaveLength(CREATOR_STRING_DEFINITIONS.length);
  });

  test('every key is spelled once', () => {
    const keys = CREATOR_STRING_DEFINITIONS.map((definition) => definition.key);

    // A duplicate would make one of the two unreachable, and the union would hide it.
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('a registered language is used, and falls back per key', () => {
    const dictionary = new CreatorStringDictionary();

    dictionary.register('fr', { save: 'Enregistrer' });

    expect(dictionary.get('fr', 'save')).toBe('Enregistrer');
    // Registering merges rather than replaces, so renaming one button does not blank the
    // other eighty.
    expect(dictionary.get('fr', 'undo')).toBe('Undo');
  });

  test('registering twice merges rather than replaces', () => {
    const dictionary = new CreatorStringDictionary();

    dictionary.register('fr', { save: 'Enregistrer' });
    dictionary.register('fr', { undo: 'Annuler' });

    // A host translating in two passes — or a plugin adding a few words to a language the
    // application already registered — must not blank what was there.
    expect(dictionary.get('fr', 'save')).toBe('Enregistrer');
    expect(dictionary.get('fr', 'undo')).toBe('Annuler');
  });

  test('a regional locale falls back to its base language', () => {
    const dictionary = new CreatorStringDictionary();
    dictionary.register('fr', { save: 'Enregistrer' });

    expect(dictionary.get('fr-CA', 'save')).toBe('Enregistrer');
  });

  test('an English override is seen by a Creator that names no locale', () => {
    const dictionary = new CreatorStringDictionary();

    dictionary.register('en', { save: 'Publish' });

    // J2's own finding: falling through to the shipped constant quietly ignored every
    // override on the commonest path there is.
    expect(dictionary.get('en', 'save')).toBe('Publish');
    expect(dictionary.get('de', 'save')).toBe('Publish');
  });

  test('a language nobody registered still says something', () => {
    // An untranslated button with no label is worse in every language than one labelled in
    // the wrong one.
    expect(new CreatorStringDictionary().get('ja', 'save')).toBe('Save');
  });

  test('white labelling is renaming, not translating', () => {
    const dictionary = new CreatorStringDictionary();

    dictionary.register('en', { tabDesign: 'Build', save: 'Publish', delete: 'Remove' });

    expect(dictionary.get('en', 'tabDesign')).toBe('Build');
    expect(dictionary.get('en', 'delete')).toBe('Remove');
  });
});

describe('parity/N3-format', () => {
  test('placeholders are filled in order', () => {
    expect(formatCreatorString('{0} in {1}', ['Title', 'fr'])).toBe('Title in fr');
    expect(formatCreatorString('Filled {0} strings into {1}.', [3, 'de'])).toBe(
      'Filled 3 strings into de.',
    );
  });

  test('a missing parameter leaves its placeholder alone', () => {
    // "Filled {0} strings" is obviously a bug; "Filled undefined strings" looks like a
    // number that went wrong somewhere else.
    expect(formatCreatorString('Filled {0} strings', [])).toBe('Filled {0} strings');
  });

  test('a template with no placeholders is left as it is', () => {
    expect(formatCreatorString('Undo', ['ignored'])).toBe('Undo');
  });

  test('the dictionary formats what it returns', () => {
    const dictionary = new CreatorStringDictionary();

    expect(dictionary.get('en', 'titleOf', 'who')).toBe('Title of who');
    expect(dictionary.get('en', 'translationCount', 12)).toBe('12 strings');
  });
});
