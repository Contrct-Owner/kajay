import { parseSurvey, RegexValidator } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/**
 * The built-in checks, exercised through a real survey rather than by constructing a
 * validator and calling it. What a row is worth proving is that an authored definition
 * produces the message — a unit test of `validate()` would pass just as happily with
 * the collection never reaching the question.
 */
function build(
  validators: readonly Readonly<Record<string, unknown>>[],
  question: Readonly<Record<string, unknown>> = {},
): Survey {
  return parseSurvey(
    {
      pages: [
        { name: 'p1', elements: [{ type: 'text', name: 'q', validators, ...question }] },
      ],
    },
    createTestRegistry(),
  ).survey;
}

function messagesFor(survey: Survey, value: unknown): readonly string[] {
  survey.setValue('q', value);
  survey.validation.validateCurrentPage();
  return (survey.getQuestionByName('q')?.errors ?? []).map((error) => error.text);
}

/** Two questions, so an expression validator has another answer to compare against. */
function buildPair(expression: string): Survey {
  return parseSurvey(
    {
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'floor' },
            { type: 'text', name: 'q', validators: [{ type: 'expressionvalidator', expression }] },
          ],
        },
      ],
    },
    createTestRegistry(),
  ).survey;
}

describe('parity/D2-built-in-validators', () => {
  test('numeric rejects a non-number and enforces both bounds', () => {
    const survey = build([{ type: 'numericvalidator', minValue: 5, maxValue: 10 }]);
    expect(messagesFor(survey, 'abc')).toEqual(['Please enter a number.']);
    expect(messagesFor(survey, 4)).toEqual(['Please enter a value no less than 5.']);
    expect(messagesFor(survey, 11)).toEqual(['Please enter a value no greater than 10.']);
    expect(messagesFor(survey, 7)).toEqual([]);
  });

  test('numeric accepts a numeric string, because that is what a text input hands back', () => {
    const survey = build([{ type: 'numericvalidator', minValue: 5 }]);
    expect(messagesFor(survey, '7')).toEqual([]);
    expect(messagesFor(survey, '4')).toEqual(['Please enter a value no less than 5.']);
  });

  test('an omitted bound is not a bound of zero', () => {
    const survey = build([{ type: 'numericvalidator', maxValue: 10 }]);
    expect(messagesFor(survey, -100)).toEqual([]);
  });

  test('text enforces length and, when asked, bans digits', () => {
    const survey = build([{ type: 'textvalidator', minLength: 3, maxLength: 5 }]);
    expect(messagesFor(survey, 'ab')).toEqual(['Please enter at least 3 characters.']);
    expect(messagesFor(survey, 'abcdef')).toEqual(['Please enter no more than 5 characters.']);
    expect(messagesFor(survey, 'abc1')).toEqual([]);

    const noDigits = build([{ type: 'textvalidator', allowDigits: false }]);
    expect(messagesFor(noDigits, 'abc1')).toEqual(['Please enter a value without digits.']);
    expect(messagesFor(noDigits, 'abc')).toEqual([]);
  });

  test('regex matches, and an authored message replaces the built-in one', () => {
    const survey = build([
      { type: 'regexvalidator', regex: '^KJ-\\d{4}$', text: 'Use the form KJ-1234.' },
    ]);
    expect(messagesFor(survey, 'nope')).toEqual(['Use the form KJ-1234.']);
    expect(messagesFor(survey, 'KJ-0042')).toEqual([]);
  });

  test('an unparseable pattern blocks nobody, and says so', () => {
    const survey = build([{ type: 'regexvalidator', regex: '[a-z' }]);
    // The respondent did not write the pattern and cannot fix it, so it is treated as
    // no rule rather than as a failure they can never clear.
    expect(messagesFor(survey, 'anything')).toEqual([]);

    const [validator] = survey.getQuestionByName('q')?.validators ?? [];
    expect(validator).toBeInstanceOf(RegexValidator);
    expect(validator instanceof RegexValidator && validator.hasInvalidPattern).toBe(true);
  });

  test('email catches the typo without being clever about it', () => {
    const survey = build([{ type: 'emailvalidator' }]);
    expect(messagesFor(survey, 'ada.example.com')).toEqual([
      'Please enter a valid email address.',
    ]);
    expect(messagesFor(survey, 'ada@example.com')).toEqual([]);
    expect(messagesFor(survey, "o'hara+tag@sub.example.co.uk")).toEqual([]);
  });

  test('answercount counts a multi-select answer', () => {
    const survey = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              {
                type: 'checkbox',
                name: 'q',
                choices: ['a', 'b', 'c'],
                validators: [{ type: 'answercountvalidator', minCount: 2, maxCount: 2 }],
              },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;

    expect(messagesFor(survey, ['a'])).toEqual(['Please select at least 2 options.']);
    expect(messagesFor(survey, ['a', 'b', 'c'])).toEqual([
      'Please select no more than 2 options.',
    ]);
    expect(messagesFor(survey, ['a', 'b'])).toEqual([]);
  });

  test('every failing validator reports, not just the first', () => {
    const survey = build([
      { type: 'textvalidator', minLength: 10 },
      { type: 'emailvalidator' },
    ]);
    expect(messagesFor(survey, 'nope')).toHaveLength(2);
  });

  test('an empty answer is required-ness business, so no validator sees it', () => {
    // Without this, omitting an answer would produce both "this is required" and
    // "please enter at least 3 characters" for the same single omission.
    const survey = build([{ type: 'textvalidator', minLength: 3 }], { isRequired: true });
    expect(messagesFor(survey, '')).toEqual(['This question requires an answer.']);
  });
});

describe('parity/D2-expression-validator', () => {
  test('a condition over another answer decides the outcome', () => {
    const survey = buildPair('{q} > {floor}');
    survey.setValue('floor', 10);
    expect(messagesFor(survey, 5)).toEqual([
      'This answer does not meet the required condition.',
    ]);
    expect(messagesFor(survey, 20)).toEqual([]);
  });

  test('an expression that cannot be evaluated blocks nobody', () => {
    // Same reasoning as the broken regex: an author's typo must not become a dead end
    // for a respondent, and `undefined` alone could not tell "unusable" from "false".
    const survey = buildPair('{q} > (((');
    expect(messagesFor(survey, 1)).toEqual([]);
  });
});
