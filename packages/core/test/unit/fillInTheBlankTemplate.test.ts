import { parseBlankTemplate, parseSurvey } from '@kajay/core';
import { FillInTheBlankQuestion } from '@kajay/core';
import type { Survey, SurveyDefinition } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(
  template: string,
  blanks: readonly Record<string, unknown>[],
): { readonly survey: Survey; readonly question: FillInTheBlankQuestion } {
  const definition: SurveyDefinition = {
    pages: [
      { name: 'p1', elements: [{ type: 'fillintheblank', name: 'q', template, blanks }] },
    ],
  };
  const { survey } = parseSurvey(definition, createTestRegistry(), {});
  const question = survey.getQuestionByName('q');
  if (!(question instanceof FillInTheBlankQuestion)) {
    throw new TypeError('expected a fillintheblank question');
  }
  return { survey, question };
}

describe('parity/C13-template', () => {
  test('prose splits into the text around its blanks and the blanks themselves', () => {
    expect(parseBlankTemplate('The capital is [[capital]].')).toEqual([
      { kind: 'text', text: 'The capital is ' },
      { kind: 'blank', name: 'capital' },
      { kind: 'text', text: '.' },
    ]);
  });

  test('a blank at either end emits no empty text around it', () => {
    // A translator is free to move a marker to the very start of a sentence, and an empty
    // run either side of it would be a node the renderer draws for nothing.
    expect(parseBlankTemplate('[[who]] answered')).toEqual([
      { kind: 'blank', name: 'who' },
      { kind: 'text', text: ' answered' },
    ]);
  });

  test('order is preserved, because the sentence is the layout', () => {
    expect(parseBlankTemplate('[[a]] then [[b]]').map((segment) => segment.kind)).toEqual([
      'blank',
      'text',
      'blank',
    ]);
  });

  test('brackets that do not name a blank are prose, so no escape is needed', () => {
    // `[[` opens a blank only when a valid name and `]]` follow. An escape character would
    // land in authored prose and in every translator's copy of it.
    for (const template of ['see [[1]] below', 'an [[ open bracket', 'and [[bad name]] too']) {
      expect(parseBlankTemplate(template)).toEqual([{ kind: 'text', text: template }]);
    }
  });

  test('a name may not contain a dot, because an expression reads the answer through one', () => {
    // The answer lives in an object under the question's name and is reached as
    // `{q.capital}`; a dotted blank name would be unreachable from the language meant to
    // read it, so it is not a blank at all.
    expect(parseBlankTemplate('[[a.b]]')).toEqual([{ kind: 'text', text: '[[a.b]]' }]);
  });

  test('the same blank twice is one name, positioned twice', () => {
    expect(parseBlankTemplate('[[x]] and [[x]]').filter((s) => s.kind === 'blank')).toHaveLength(2);
  });

  test('an answer is one object keyed by blank name', () => {
    const { question } = build('The capital is [[capital]].', [{ type: 'text', name: 'capital' }]);

    question.setBlankValue('capital', 'Paris');

    // `MultipleTextQuestion`'s shape, so an expression elsewhere reaches a single blank as
    // `{q.capital}` through the resolver that already walks dotted references.
    expect(question.value).toEqual({ capital: 'Paris' });
    expect(question.getBlankValue('capital')).toBe('Paris');
  });

  test('emptying the last blank leaves no answer rather than an empty object', () => {
    const { question } = build('[[capital]]', [{ type: 'text', name: 'capital' }]);
    question.setBlankValue('capital', 'Paris');

    question.setBlankValue('capital', '');

    // `{}` is not empty by any test the engine applies, so a question-level `isRequired`
    // would be satisfied by a sentence with nothing filled in.
    expect(question.value).toBeUndefined();
  });

  test('the segments follow the template when the locale changes', () => {
    const definition: SurveyDefinition = {
      locale: 'en',
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type: 'fillintheblank',
              name: 'q',
              // Word order moves: the blank opens the German sentence and closes the
              // English one. This is why the template is a string a translator can edit.
              template: { default: 'The capital is [[capital]]', de: '[[capital]] ist die Hauptstadt' },
              blanks: [{ type: 'text', name: 'capital' }],
            },
          ],
        },
      ],
    };
    const { survey } = parseSurvey(definition, createTestRegistry(), {});
    const question = survey.getQuestionByName('q') as FillInTheBlankQuestion;
    expect(question.segments[0]?.kind).toBe('text');

    survey.setLocale('de');

    expect(question.segments[0]).toEqual({ kind: 'blank', name: 'capital' });
  });

  test('a required blank objects on its own, against its own name', () => {
    const { survey, question } = build('[[capital]] and [[currency]]', [
      { type: 'text', name: 'capital', isRequired: true },
      { type: 'text', name: 'currency' },
    ]);

    survey.validation.validateCurrentPage();

    // Reported against the blank rather than the question, so a renderer can put the
    // message beside the gap it means — in a sentence there is nowhere else it could go.
    expect(question.errors.map((error) => error.path)).toEqual(['capital']);
  });
});
