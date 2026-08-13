import { parseSurvey, scoreQuiz } from '@kajay/core';
import type { Survey, SurveyDefinition } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(blanks: readonly Record<string, unknown>[]): Survey {
  const definition: SurveyDefinition = {
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'fillintheblank',
            name: 'geography',
            template: 'The capital of France is [[capital]] and its currency is the [[currency]].',
            blanks,
          },
        ],
      },
    ],
  };
  return parseSurvey(definition, createTestRegistry(), {}).survey;
}

const MARKED = [
  { name: 'capital', correctAnswer: 'Paris' },
  { name: 'currency', correctAnswer: 'Euro' },
];

describe('parity/C13-scoring', () => {
  test('each marked blank is worth a mark', () => {
    const survey = build(MARKED);
    survey.setValue('geography', { capital: 'Paris', currency: 'Euro' });

    // Partial credit falls out of `AnswerScore` being a pair: a sentence with two gaps is
    // two decisions wearing one question, exactly as a multi-select is.
    expect(scoreQuiz(survey)).toMatchObject({ correct: 2, total: 2, questionCount: 1 });
  });

  test('half a sentence earns half the marks', () => {
    const survey = build(MARKED);
    survey.setValue('geography', { capital: 'Paris', currency: 'Dollar' });

    expect(scoreQuiz(survey)).toMatchObject({ correct: 1, total: 2 });
  });

  test('case is ignored by default, because typing is not the subject', () => {
    const survey = build(MARKED);
    survey.setValue('geography', { capital: 'paris', currency: 'EURO' });

    expect(scoreQuiz(survey)).toMatchObject({ correct: 2, total: 2 });
  });

  test('a blank may insist on case, for a code rather than a word', () => {
    const survey = build([{ name: 'capital', correctAnswer: 'Paris', caseSensitive: true }]);
    survey.setValue('geography', { capital: 'paris' });

    // One sentence can hold a prose answer and a case-sensitive code, which is why this
    // is per blank rather than per question.
    expect(scoreQuiz(survey)).toMatchObject({ correct: 0, total: 1 });
  });

  test('surrounding whitespace is ignored by default', () => {
    const survey = build(MARKED);
    survey.setValue('geography', { capital: '  Paris ', currency: 'Euro' });

    expect(scoreQuiz(survey)).toMatchObject({ correct: 2, total: 2 });
  });

  test('a blank may keep whitespace, when the spaces are the answer', () => {
    const survey = build([{ name: 'capital', correctAnswer: 'Paris', trim: false }]);
    survey.setValue('geography', { capital: ' Paris' });

    expect(scoreQuiz(survey)).toMatchObject({ correct: 0, total: 1 });
  });

  test('a numeric correct answer matches what an input actually returns', () => {
    const survey = build([{ name: 'capital', correctAnswer: 42 }]);
    survey.setValue('geography', { capital: '42' });

    // A respondent types into an input and gets a string back. A comparison that refused
    // to look at the text would mark every numeric answer wrong.
    expect(scoreQuiz(survey)).toMatchObject({ correct: 1, total: 1 });
  });

  test('only marked blanks count toward the total', () => {
    const survey = build([
      { name: 'capital', correctAnswer: 'Paris' },
      { name: 'currency' },
    ]);
    survey.setValue('geography', { capital: 'Paris', currency: 'anything at all' });

    // An author can mark two gaps and leave a third for prose the respondent is simply
    // asked to supply.
    expect(scoreQuiz(survey)).toMatchObject({ correct: 1, total: 1 });
  });

  test('a sentence nobody marked is not part of the quiz', () => {
    const survey = build([{ name: 'capital' }, { name: 'currency' }]);
    survey.setValue('geography', { capital: 'Paris' });

    // Membership is asked of the blanks, because the question-level `correctAnswer` this
    // type inherits means nothing here — reading it would leave a fully marked sentence
    // out of the quiz, or put an unmarked one in.
    expect(scoreQuiz(survey)).toMatchObject({ correct: 0, total: 0, questionCount: 0 });
  });

  test('an unanswered sentence scores zero rather than being skipped', () => {
    const survey = build(MARKED);

    expect(scoreQuiz(survey)).toMatchObject({ correct: 0, total: 2, questionCount: 1 });
  });

  test('a sentence the respondent never saw costs no marks', () => {
    const definition: SurveyDefinition = {
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'boolean', name: 'show' },
            {
              type: 'fillintheblank',
              name: 'geography',
              visibleIf: '{show} = true',
              template: 'The capital is [[capital]].',
              blanks: [{ name: 'capital', correctAnswer: 'Paris' }],
            },
          ],
        },
      ],
    };
    const survey = parseSurvey(definition, createTestRegistry(), {}).survey;

    // Only reachable questions are graded — a branch nobody saw must not be marked wrong.
    expect(scoreQuiz(survey)).toMatchObject({ correct: 0, total: 0, questionCount: 0 });
  });
});
