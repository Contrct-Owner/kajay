import {
  MatrixDynamicQuestion,
  MultipleTextQuestion,
  parseSurvey,
  SelectQuestion,
  serializeSurvey,
} from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/**
 * Localizable strings and the locale switch — checklist J1.
 *
 * The row's claim is that *every* user-facing property takes the object form, so these
 * reach past titles into choices, validators and matrix cells — the places a walk-based
 * implementation would have missed.
 */
function build(definition: Readonly<Record<string, unknown>>): Survey {
  return parseSurvey(definition, createTestRegistry()).survey;
}

const BILINGUAL = {
  locale: 'en',
  title: { default: 'A survey', fr: 'Un questionnaire' },
  pages: [
    {
      name: 'p1',
      elements: [
        {
          type: 'text',
          name: 'who',
          title: { default: 'Your name', fr: 'Votre nom' },
          placeholder: { default: 'Ada', fr: 'Adèle' },
        },
      ],
    },
  ],
};

describe('parity/J1-localizable-strings', () => {
  test('a string reads in the survey locale', () => {
    const survey = build(BILINGUAL);

    expect(survey.title).toBe('A survey');
    expect(survey.getQuestionByName('who')?.title).toBe('Your name');

    survey.setLocale('fr');
    expect(survey.title).toBe('Un questionnaire');
    expect(survey.getQuestionByName('who')?.title).toBe('Votre nom');
  });

  test('a plain string is not a translation and does not become one', () => {
    const survey = build({
      pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who', title: 'Your name' }] }],
    });
    survey.setLocale('fr');

    // The overwhelmingly common case: a property that was never authored per-locale
    // takes the same path it always did, whatever the locale says.
    expect(survey.getQuestionByName('who')?.title).toBe('Your name');
  });

  test('a locale nobody translated into falls back to the default', () => {
    const survey = build(BILINGUAL);
    survey.setLocale('de');

    expect(survey.getQuestionByName('who')?.title).toBe('Your name');
  });

  test('a regional locale falls back to its language', () => {
    const survey = build(BILINGUAL);
    survey.setLocale('fr-CA');

    // Without this a French-Canadian respondent reads English in a survey that *was*
    // translated into French, which is the failure the row exists to prevent.
    expect(survey.getQuestionByName('who')?.title).toBe('Votre nom');
  });

  test('the definition names the locale the survey opens in', () => {
    expect(build(BILINGUAL).locale).toBe('en');
    expect(build({ ...BILINGUAL, locale: 'fr' }).title).toBe('Un questionnaire');
  });

  test('switching announces once, and only on a real change', () => {
    const survey = build(BILINGUAL);
    const announced: string[] = [];
    survey.onLocaleChanged.add(({ locale }) => announced.push(locale));

    survey.setLocale('fr');
    survey.setLocale('fr');
    expect(announced).toEqual(['fr']);
  });
});

describe('parity/J1-localizable-reach', () => {
  test('choices, validators and multiple-text items translate too', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type: 'radiogroup',
              name: 'colour',
              choices: [{ value: 'red', text: { default: 'Red', fr: 'Rouge' } }],
            },
            {
              type: 'text',
              name: 'email',
              validators: [
                { type: 'emailvalidator', text: { default: 'Not an email', fr: 'Pas un courriel' } },
              ],
            },
            {
              type: 'multipletext',
              name: 'address',
              items: [{ name: 'street', title: { default: 'Street', fr: 'Rue' } }],
            },
          ],
        },
      ],
    });
    survey.setLocale('fr');

    // The reason the locale is handed out during parsing rather than walked in
    // afterwards: a walk has to know about every child collection separately, and these
    // three are exactly the ones it would have got wrong.
    const colour = survey.getQuestionByName('colour');
    expect(colour instanceof SelectQuestion && colour.visibleChoices[0]?.text).toBe('Rouge');
    survey.setValue('email', 'nope');
    survey.validation.validateAll();
    expect(survey.getQuestionByName('email')?.errors[0]?.text).toBe('Pas un courriel');
    const address = survey.getQuestionByName('address');
    expect(address instanceof MultipleTextQuestion && address.items[0]?.title).toBe('Rue');
  });

  test('a matrix cell built after the switch reads the new locale', () => {
    const survey = parseSurvey({
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type: 'matrixdynamic',
              name: 'lines',
              rowTitleFormat: { default: 'Line {0}', fr: 'Ligne {0}' },
              columns: [{ type: 'text', name: 'what', title: { default: 'What', fr: 'Quoi' } }],
            },
          ],
        },
      ],
    }).survey;
    const matrix = survey.getQuestionByName('lines');
    if (!(matrix instanceof MatrixDynamicQuestion)) {
      throw new TypeError('The fixture must build a dynamic matrix.');
    }
    survey.setValue('lines', [{ what: 'a' }]);

    survey.setLocale('fr');
    // An instance title is composed at build time out of the template's *resolved*
    // title, so this only passes because a locale switch throws the instances away.
    const cells = matrix.cellsFor(matrix.rowKeys[0] ?? '');
    expect(cells[0]?.title).toBe('Ligne 1 Quoi');
  });
});

describe('parity/J1-localized-round-trip', () => {
  test('a localized property is stored as authored', () => {
    const survey = build(BILINGUAL);
    survey.setLocale('fr');

    // Read in French, written back bilingual. A model that resolved on the way in would
    // come back from a round trip monolingual, silently losing every other translation.
    const canonical = serializeSurvey(survey) as Record<string, unknown>;
    expect(canonical['title']).toEqual({ default: 'A survey', fr: 'Un questionnaire' });
  });

  test('the locale a respondent switched to is not part of the definition', () => {
    const survey = build(BILINGUAL);
    survey.setLocale('fr');

    // The same division the definition draws everywhere else: it records the rule, not
    // the rule's current answer.
    expect((serializeSurvey(survey) as Record<string, unknown>)['locale']).toBe('en');
  });

  test('an object on a property nobody may translate is still a type error', () => {
    const parsed = parseSurvey(
      {
        pages: [
          { name: 'p1', elements: [{ type: 'text', name: 'who', visibleIf: { fr: '{a} = 1' } }] },
        ],
      },
      createTestRegistry(),
    );

    // Translating a condition would break the survey in whichever language somebody
    // translated it into, which is why localizability is declared rather than inferred
    // from the type.
    expect(parsed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'property-type-mismatch',
    ]);
  });

  test('an object whose entries are not strings is refused', () => {
    const parsed = parseSurvey(
      {
        pages: [
          { name: 'p1', elements: [{ type: 'text', name: 'who', title: { default: 42 } }] },
        ],
      },
      createTestRegistry(),
    );

    expect(parsed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'property-type-mismatch',
    ]);
  });
});
