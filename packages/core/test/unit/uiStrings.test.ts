import {
  EN_STRINGS,
  formatUiString,
  parseSurvey,
  StringDictionary,
  UI_STRING_DEFINITIONS,
} from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/**
 * The library's own words — checklist J2.
 */
function build(definition: Readonly<Record<string, unknown>>): Survey {
  return parseSurvey(definition, createTestRegistry()).survey;
}

describe('parity/J2-string-catalogue', () => {
  test('English is complete by construction', () => {
    // Not a test that somebody remembered to translate: the catalogue *is* the English,
    // so a key can only exist by having its English text written beside it.
    expect(Object.keys(EN_STRINGS)).toHaveLength(UI_STRING_DEFINITIONS.length);
    for (const definition of UI_STRING_DEFINITIONS) {
      expect(EN_STRINGS[definition.key]).toBe(definition.en);
    }
  });

  test('every key is unique', () => {
    const keys = UI_STRING_DEFINITIONS.map((definition) => definition.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('a placeholder with no argument is left as written', () => {
    // Better a visible `{1}` than a silent empty space: the first says a caller is
    // passing too few arguments, the second reads as a translation with a gap in it.
    expect(formatUiString('{0} of {1}', [3])).toBe('3 of {1}');
  });
});

describe('parity/J2-string-dictionary', () => {
  test('the seed locales answer in their own language', () => {
    const strings = new StringDictionary();

    expect(strings.get('en', 'nextPage')).toBe('Next');
    expect(strings.get('fr', 'nextPage')).toBe('Suivant');
    expect(strings.get('de', 'nextPage')).toBe('Weiter');
    expect(strings.get('es', 'nextPage')).toBe('Siguiente');
  });

  test('a regional locale falls back to its language, then to English', () => {
    const strings = new StringDictionary();

    expect(strings.get('fr-CA', 'nextPage')).toBe('Suivant');
    // Never empty. An unlabelled button is worse in every language than one labelled in
    // the wrong one.
    expect(strings.get('cy', 'nextPage')).toBe('Next');
  });

  test('a host overrides one string without blanking the rest', () => {
    const strings = new StringDictionary();
    strings.register('en', { nextPage: 'Onwards' });

    expect(strings.get('en', 'nextPage')).toBe('Onwards');
    expect(strings.get('en', 'prevPage')).toBe('Previous');
  });

  test('a host can add a locale nobody shipped', () => {
    const strings = new StringDictionary();
    strings.register('cy', { nextPage: 'Nesaf' });

    expect(strings.get('cy', 'nextPage')).toBe('Nesaf');
    expect(strings.get('cy', 'prevPage')).toBe('Previous');
  });

  test('two surveys in one process do not share wording', () => {
    const first = build({ pages: [{ name: 'p1' }] });
    const second = build({ pages: [{ name: 'p1' }] });
    first.strings.register('en', { nextPage: 'Tenant one' });

    // The reason the dictionary is per survey rather than global: a host serving two
    // tenants must be able to word them differently.
    expect(first.uiText('nextPage')).toBe('Tenant one');
    expect(second.uiText('nextPage')).toBe('Next');
  });
});

describe('parity/J2-messages-are-localized', () => {
  function validated(locale: string): Survey {
    const survey = build({
      locale,
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'who', isRequired: true },
            { type: 'text', name: 'mail', validators: [{ type: 'emailvalidator' }] },
            { type: 'comment', name: 'notes', maxLength: 5 },
          ],
        },
      ],
    });
    survey.setValue('mail', 'nope');
    survey.setValue('notes', 'far too long');
    survey.validation.validateAll();
    return survey;
  }

  test('validation speaks the survey language', () => {
    const english = validated('en');
    expect(english.getQuestionByName('who')?.errors[0]?.text).toBe(
      'This question requires an answer.',
    );
    expect(english.getQuestionByName('mail')?.errors[0]?.text).toBe(
      'Please enter a valid email address.',
    );

    const french = validated('fr');
    expect(french.getQuestionByName('who')?.errors[0]?.text).toBe(
      'Cette question exige une réponse.',
    );
    expect(french.getQuestionByName('mail')?.errors[0]?.text).toBe(
      'Veuillez saisir une adresse e-mail valide.',
    );
  });

  test('a message with a number keeps the number', () => {
    expect(validated('fr').getQuestionByName('notes')?.errors[0]?.text).toBe(
      'Veuillez réduire ce texte à 5 caractères ou moins.',
    );
  });

  test("an author's own message still wins over the library's", () => {
    const survey = build({
      locale: 'fr',
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'who', isRequired: true, requiredErrorText: 'On veut un nom.' },
          ],
        },
      ],
    });
    survey.validation.validateAll();

    // The dictionary is the library's fallback, never a replacement for what an author
    // wrote — including a `requiredErrorText` that is itself a localized object.
    expect(survey.getQuestionByName('who')?.errors[0]?.text).toBe('On veut un nom.');
  });

  test('switching language re-words the next check', () => {
    const survey = validated('en');
    survey.setLocale('de');
    survey.validation.validateAll();

    expect(survey.getQuestionByName('who')?.errors[0]?.text).toBe(
      'Diese Frage erfordert eine Antwort.',
    );
  });
});
