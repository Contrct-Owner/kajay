import { parseSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(definition: Readonly<Record<string, unknown>>): Survey {
  return parseSurvey(definition, createTestRegistry()).survey;
}

/** Two pages, each with one required question. The shape most of §D needs. */
function twoRequiredPages(): Survey {
  return build({
    pages: [
      { name: 'p1', elements: [{ type: 'text', name: 'a', isRequired: true }] },
      { name: 'p2', elements: [{ type: 'text', name: 'b', isRequired: true }] },
    ],
  });
}

function errorsOf(survey: Survey, name: string): readonly string[] {
  return (survey.getQuestionByName(name)?.errors ?? []).map((error) => error.text);
}

describe('parity/D1-required', () => {
  test('a required question with no answer blocks the move and says why', () => {
    const survey = twoRequiredPages();
    expect(survey.nextPageOrComplete()).toBe('blocked');
    expect(survey.currentPageNo).toBe(0);
    expect(errorsOf(survey, 'a')).toEqual(['This question requires an answer.']);
  });

  test('answering clears the error and lets the move through', () => {
    const survey = twoRequiredPages();
    survey.nextPageOrComplete();
    survey.setValue('a', 'Ada');

    expect(survey.nextPageOrComplete()).toBe('advanced');
    expect(survey.currentPageNo).toBe(1);
    expect(errorsOf(survey, 'a')).toEqual([]);
  });

  test('requiredErrorText replaces the built-in message', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'a', isRequired: true, requiredErrorText: 'We need your name.' },
          ],
        },
      ],
    });
    survey.nextPageOrComplete();
    expect(errorsOf(survey, 'a')).toEqual(['We need your name.']);
  });

  test('requiredIf drives requiredness, so validation follows the condition', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'trigger' },
            { type: 'text', name: 'a', requiredIf: '{trigger} notempty' },
          ],
        },
      ],
    });
    expect(survey.validation.validateCurrentPage()).toBe(true);

    survey.setValue('trigger', 'x');
    expect(survey.validation.validateCurrentPage()).toBe(false);
  });
});

describe('parity/D5-validation-scope', () => {
  test('only the current page is checked on the way out of it', () => {
    const survey = twoRequiredPages();
    survey.setValue('a', 'Ada');
    survey.nextPageOrComplete();

    // Page 2 is now current and empty, but page 1's question was never re-reported.
    expect(survey.validation.validateCurrentPage()).toBe(false);
    expect(errorsOf(survey, 'b')).toHaveLength(1);
    expect(errorsOf(survey, 'a')).toEqual([]);
  });

  test('validate() covers every reachable question at once', () => {
    const survey = twoRequiredPages();
    expect(survey.validation.validateAll()).toBe(false);
    expect(errorsOf(survey, 'a')).toHaveLength(1);
    expect(errorsOf(survey, 'b')).toHaveLength(1);
  });

  test('a question hidden by logic is not checked', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'trigger' },
            {
              type: 'text',
              name: 'a',
              isRequired: true,
              visibleIf: '{trigger} notempty',
            },
          ],
        },
      ],
    });
    // Requiring an answer nobody can see would refuse to advance with nothing on
    // screen to act on.
    expect(survey.validation.validateCurrentPage()).toBe(true);

    survey.setValue('trigger', 'x');
    expect(survey.validation.validateCurrentPage()).toBe(false);
  });

  test('a question inside a hidden panel is not checked either', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'trigger' },
            {
              type: 'panel',
              name: 'group',
              visibleIf: '{trigger} notempty',
              elements: [{ type: 'text', name: 'a', isRequired: true }],
            },
          ],
        },
      ],
    });
    expect(survey.validation.validateCurrentPage()).toBe(true);
  });

  test('a disabled question is still checked: enableIf freezes an answer, it does not withdraw the question', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'trigger' },
            {
              type: 'text',
              name: 'a',
              isRequired: true,
              enableIf: '{trigger} notempty',
            },
          ],
        },
      ],
    });
    expect(survey.validation.validateCurrentPage()).toBe(false);
  });
});
